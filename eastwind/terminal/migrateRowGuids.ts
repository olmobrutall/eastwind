// One-off migration for an EXISTING altea database, run BEFORE the `sync` that turns the user-asset
// collection rows' primary key into a uuid.
//
// Nine collections are now declared `@primaryKey("uuid")`, because Signum declares them
// `[PrimaryKey(typeof(Guid))]` so that "the row id identifies the element in the XML". Three of them —
// a dashboard's parts and both toolbar element tables — used to carry a SEPARATE `guid` column for exactly
// that purpose, altea's workaround for the row id being an int. That guid is the identity those rows are
// already known by: an exported dashboard or toolbar XML references a part/element by it, and a tour's
// "DashboardPart" css step stores it as a plain string (not a foreign key, so nothing would cascade).
//
// A plain `sync` would assign FRESH uuids and then drop the guid column, silently breaking every one of
// those references. This moves the guid INTO the primary key first, so the identity is preserved and the
// sync then has nothing left to do for those three tables.
//
// The other six collections (query/chart filters and columns, the two template filter tables) had an int
// id and no guid, so there is nothing to preserve — they get fresh uuids. That is only safe because
// nothing outside the row references those ids: the XML is re-exported with the new ones, and a
// TranslatedInstance keyed to such a row (its `instance` is the row's own lite) would have to be re-linked
// — check `translation.translated_instance` before running this on a database that has translations.
//
// Idempotent, one transaction; safe to re-run.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/migrateRowGuids.js
import { Starter } from "../starter.server";
import { StartParameters } from "@altea/altea/data/utils/startParameters";
import { Connector } from "@altea/altea/server/connection/connector";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { SafeConsole } from "@altea/altea/server/safeConsole";
import chalk from "chalk";

/** The three tables whose existing `guid` column becomes their primary key. */
const TABLES = [
    { table: "dashboard.dashboard__part", pk: "pk_dashboard__part" },
    { table: "toolbar.toolbar__element", pk: "pk_toolbar__element" },
    { table: "toolbar.toolbar_menu__element", pk: "pk_toolbar_menu__element" },
];

async function main(): Promise<void> {
    // The schema TRAILS the code by definition here, so the startup caches must collect their mismatches
    // rather than throw — the same accommodation the terminal makes for `sync`.
    await StartParameters.withIgnoredDatabaseMismatches(() => Starter.start(process.env["EASTWIND_DB"]!));
    const connector = Connector.current();

    await Transaction.create(async () => {
        for (const { table, pk } of TABLES) {
            if (!await hasColumn(table, "guid")) {
                console.log(`  skip ${table} (already migrated — no 'guid' column)`);
                continue;
            }
            if (await columnType(table, "id") === "uuid") {
                console.log(`  skip ${table} (id is already uuid)`);
                continue;
            }

            const rows = (await connector.executeQuery(
                `SELECT count(*)::int AS n FROM ${table} WHERE guid IS NULL OR guid = ''`) as { n: number }[])[0]!.n;
            if (rows > 0)
                throw new Error(`${table}: ${rows} row(s) have no guid, so their identity cannot be preserved. `
                    + "Fill or delete them first.");

            // Nothing references these rows by foreign key (they are leaf part rows reached through their
            // owner's back reference), so the swap needs no cascade — unlike the int→uuid migration the
            // synchronizer scripts for the other collections.
            await connector.executeNonQuery(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS ${pk}`);
            await connector.executeNonQuery(`ALTER TABLE ${table} DROP COLUMN id`);
            await connector.executeNonQuery(`ALTER TABLE ${table} RENAME COLUMN guid TO id`);
            await connector.executeNonQuery(`ALTER TABLE ${table} ALTER COLUMN id TYPE uuid USING id::uuid`);
            await connector.executeNonQuery(`ALTER TABLE ${table} ALTER COLUMN id SET NOT NULL`);
            await connector.executeNonQuery(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
            await connector.executeNonQuery(`ALTER TABLE ${table} ADD CONSTRAINT ${pk} PRIMARY KEY (id)`);

            console.log(`  ${table}: guid promoted to the primary key`);
        }
    });

    SafeConsole.writeLineColor(chalk.green,
        "[migrate] row guids preserved — now run 'sync' for the remaining collections.");
    await connector.closeConnection();
}

async function hasColumn(qualified: string, column: string): Promise<boolean> {
    return await columnType(qualified, column) != undefined;
}

async function columnType(qualified: string, column: string): Promise<string | undefined> {
    const [schema, name] = qualified.split(".");
    const rows = await Connector.current().executeQuery(
        `SELECT data_type FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
        [schema, name, column]) as { data_type: string }[];
    return rows[0]?.data_type;
}

void main();
