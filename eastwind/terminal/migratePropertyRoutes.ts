// One-off migration for an EXISTING altea database, run BEFORE the `sync` that introduces
// `basics.property_route`.
//
// The five consumers of a property route used to store it INLINE — `auth.rule_property` as
// (root_type_id, path), `help.type_help__property` / `tour.css_step_embedded` /
// `dynamic.dynamic_validation` / `translation.translated_instance` as a path string — and now hold a
// foreign key to the routes table (see altea/data/propertyRouteEntity.ts). A schema sync cannot do that
// conversion: it would add the new column with a default of 0 and drop the old ones in the same script,
// which loses every row's route and then fails on the new foreign key. So the DATA has to move first.
//
// This runs in ONE transaction and is idempotent, so it is safe to re-run: the table is created only if
// absent, each route is inserted only if missing, and each new column is added only if it is not there yet.
// Afterwards run the ordinary `sync`, which then has nothing left to do but drop the old columns.
//
// A SIGNUM database needs none of this — it already has the table and all five foreign keys, which is the
// whole reason the type was ported.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/migratePropertyRoutes.js
import { Starter } from "../starter.server";
import { StartParameters } from "@altea/altea/data/utils/startParameters";
import { Connector } from "@altea/altea/server/connection/connector";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { SafeConsole } from "@altea/altea/server/safeConsole";
import chalk from "chalk";

/** A consumer table: where its route used to live, and the FK column it takes. */
interface Consumer {
    table: string;
    /** The old path column. */
    pathColumn: string;
    /** The old root-type column, where the table had one; otherwise the root type is derived (see below). */
    rootTypeColumn?: string;
    /** How to find the root type when the table did not store one, as `<table>.<column>` joined by id. */
    rootTypeVia?: { column: string; sql: string };
    newColumn: string;
    nullable: boolean;
}

// The route's root type is only stored by the two tables that needed it for a lookup. For the other three
// it is implied: a help row's type comes from its TypeHelp, a validation's from its own `entity_type_id`,
// and a tour css step's from the tour's trigger — which may be a symbol, so those are migrated only where
// the trigger IS a Lite<TypeEntity> and reported otherwise.
const CONSUMERS: Consumer[] = [
    { table: "auth.rule_property", pathColumn: "path", rootTypeColumn: "root_type_id", newColumn: "resource_id", nullable: false },
    { table: "translation.translated_instance", pathColumn: "property_route", rootTypeColumn: "root_type_id", newColumn: "property_route_id", nullable: false },
    {
        table: "help.type_help__property", pathColumn: "property_route", newColumn: "property_id", nullable: false,
        rootTypeVia: { column: "root_type_id", sql: "SELECT th.type_id FROM help.type_help th WHERE th.id = t.type_help_id" },
    },
    {
        table: "dynamic.dynamic_validation", pathColumn: "sub_entity", newColumn: "sub_entity_id", nullable: true,
        rootTypeVia: { column: "root_type_id", sql: "SELECT t.entity_type_id" },
    },
    {
        table: "tour.css_step_embedded", pathColumn: "property", newColumn: "property_id", nullable: true,
        rootTypeVia: {
            column: "root_type_id",
            sql: "SELECT tr.trigger_id_type FROM tour.tour_step ts JOIN tour.tour tr ON tr.id = ts.tour_id WHERE ts.id = t.tour_step_id",
        },
    },
];

async function main(): Promise<void> {
    // This runs against a schema that TRAILS the code by definition — `basics.type` has no
    // PropertyRouteEntity row yet — so the startup caches must collect their mismatches instead of
    // throwing, exactly as the terminal does for `sync`.
    await StartParameters.withIgnoredDatabaseMismatches(() => Starter.start(process.env["EASTWIND_DB"]!));
    const connector = Connector.current();

    await Transaction.create(async () => {
        // 1. the table, if the sync has not created it yet. The PK is an IDENTITY column, not a `serial`:
        //    that is what altea generates, and a serial's sequence DEFAULT makes the sync's
        //    `ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY` fail ("already has a default value").
        await connector.executeNonQuery(`
            CREATE TABLE IF NOT EXISTS basics.property_route (
                id int4 GENERATED ALWAYS AS IDENTITY,
                path varchar NOT NULL,
                root_type_id int4 NOT NULL,
                CONSTRAINT pk_property_route PRIMARY KEY (id))`);
        await connector.executeNonQuery(
            `CREATE UNIQUE INDEX IF NOT EXISTS uix_property_route_path_root_type_id ON basics.property_route (path, root_type_id)`);

        // Repair a table an earlier run of this script created as `serial`: convert it to an identity
        // column and restart the sequence past the rows that already exist.
        await connector.executeNonQuery(`
            DO $$
            DECLARE next_id int;
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns
                           WHERE table_schema = 'basics' AND table_name = 'property_route'
                             AND column_name = 'id' AND is_identity = 'NO' AND column_default IS NOT NULL) THEN
                    ALTER TABLE basics.property_route ALTER COLUMN id DROP DEFAULT;
                    ALTER TABLE basics.property_route ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY;
                    SELECT COALESCE(MAX(id), 0) + 1 INTO next_id FROM basics.property_route;
                    EXECUTE format('ALTER TABLE basics.property_route ALTER COLUMN id RESTART WITH %s', next_id);
                END IF;
            END $$`);

        for (const c of CONSUMERS) {
            if (!await exists(c.table)) {
                console.log(`  skip ${c.table} (no such table)`);
                continue;
            }
            if (!await hasColumn(c.table, c.pathColumn)) {
                console.log(`  skip ${c.table} (already migrated — no '${c.pathColumn}' column)`);
                continue;
            }

            const rootType = c.rootTypeColumn != null
                ? `t.${c.rootTypeColumn}`
                : `(${c.rootTypeVia!.sql})`;

            // 2. a route row per distinct (rootType, path) the table names. A row whose root type cannot be
            //    resolved (a tour on a symbol trigger) is left for the report below.
            const inserted = await connector.executeNonQuery(`
                INSERT INTO basics.property_route (path, root_type_id)
                SELECT DISTINCT t.${c.pathColumn}, ${rootType}
                FROM ${c.table} t
                WHERE t.${c.pathColumn} IS NOT NULL AND t.${c.pathColumn} <> '' AND (${rootType}) IS NOT NULL
                ON CONFLICT (path, root_type_id) DO NOTHING`);

            // 3. the FK column, then point each row at its route.
            if (!await hasColumn(c.table, c.newColumn))
                await connector.executeNonQuery(`ALTER TABLE ${c.table} ADD COLUMN ${c.newColumn} int4 NULL`);

            const updated = await connector.executeNonQuery(`
                UPDATE ${c.table} t
                SET ${c.newColumn} = pr.id
                FROM basics.property_route pr
                WHERE pr.path = t.${c.pathColumn} AND pr.root_type_id = (${rootType})
                  AND t.${c.newColumn} IS DISTINCT FROM pr.id`);

            const orphans = (await connector.executeQuery(
                `SELECT count(*)::int AS n FROM ${c.table} t
                 WHERE t.${c.pathColumn} IS NOT NULL AND t.${c.pathColumn} <> '' AND t.${c.newColumn} IS NULL`,
            ) as { n: number }[])[0]!.n;

            console.log(`  ${c.table}: +${inserted} route(s), ${updated} row(s) linked`
                + (orphans === 0 ? "" : chalk.yellow(`, ${orphans} UNRESOLVED`)));

            if (orphans > 0 && !c.nullable)
                SafeConsole.writeLineColor(chalk.yellow,
                    `    ${c.table}.${c.newColumn} is NOT NULL in the model, so those ${orphans} row(s) must be `
                    + `fixed or deleted before the sync can add the constraint.`);
        }

        await connector.executeNonQuery(
            `ALTER TABLE basics.property_route DROP CONSTRAINT IF EXISTS fk_property_route_root_type_id`);
        await connector.executeNonQuery(
            `ALTER TABLE basics.property_route ADD CONSTRAINT fk_property_route_root_type_id `
            + `FOREIGN KEY (root_type_id) REFERENCES basics.type(id)`);
    });

    SafeConsole.writeLineColor(chalk.green, "[migrate] property routes converted — now run 'sync' to drop the old columns.");
    await connector.closeConnection();
}

async function exists(qualified: string): Promise<boolean> {
    const [schema, name] = qualified.split(".");
    const rows = await Connector.current().executeQuery(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`, [schema, name]);
    return rows.length > 0;
}

async function hasColumn(qualified: string, column: string): Promise<boolean> {
    const [schema, name] = qualified.split(".");
    const rows = await Connector.current().executeQuery(
        `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
        [schema, name, column]);
    return rows.length > 0;
}

void main();
