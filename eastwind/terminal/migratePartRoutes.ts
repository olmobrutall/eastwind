// One-off migration for an EXISTING altea database, run BEFORE the `sync` that follows the "a `@part`
// never roots a PropertyRoute" change.
//
// A `@part` row is altea's stand-in for a Signum `MList` element or an owned `EmbeddedEntity`, both of
// which Signum FLATTENS into the owner's route: `Product.AdditionalInformation/Key`. altea gave the part
// a class, so a route through one used to RE-ROOT and be written down as
// `(Product_AdditionalInformation).key` — a second name for the same member, invisible to a lookup made
// through the owner and with no counterpart in a Signum database at all (eastwind's own AuthRules.xml
// carries Southwind's `Product|AdditionalInformation/Key` rule commented out for exactly this reason).
//
// Routes are spelled through the owner now, and `basics.property_route` refuses a part root. The
// synchronizer therefore sees every part-rooted row as REMOVED and scripts a DELETE — which cascades to
// every consumer pointing at it: a property authorization rule, a property's help, a tour css step, a
// dynamic validation, a translated instance. So the rows have to be RE-SPELLED first, which is what this
// does: one transaction, idempotent, safe to re-run.
//
// For each stored route rooted at a `@part`, the owner chain is walked to the nearest non-part entity and
// the path is rebuilt the way `PropertyRoute.propertyString()` now spells it — `parts/member` through a
// collection, `part.member` through a single reference, and `storedMemberName` for the casing, so a
// legacy-mode database gets Signum's PascalCase. Then either the row is UPDATED in place, or — when the
// owner-rooted row already exists — every consumer is repointed at it and the duplicate is deleted.
//
// A SIGNUM database needs none of this: its routes were always spelled through the owner.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/migratePartRoutes.js
import { Starter } from "../starter.server";
import { StartParameters } from "@altea/altea/data/utils/startParameters";
import { Connector } from "@altea/altea/server/connection/connector";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { SafeConsole } from "@altea/altea/server/safeConsole";
import { Entity } from "@altea/altea/data/entity";
import { getRegisteredTypes, tryGetTypeInfo } from "@altea/altea/data/reflection";
import { cleanTypeName } from "@altea/altea/data/registration";
import { isPartType, storedMemberName } from "@altea/altea/data/propertyRoute";
import chalk from "chalk";

/** How a `@part` hangs off the entity that owns it. */
interface OwnerEdge {
    owner: Function;
    /** The owner's field holding it. */
    member: string;
    /** A collection (`parts/member`) rather than a single reference (`part.member`). */
    collection: boolean;
}

/**
 * part -> its owner edge, from REFLECTION rather than the schema: the migration needs the FIELD name,
 * which `PartOwnership.partEdges` (which answers the same question for authorization) does not carry.
 * A `@backReference` is skipped — it is the child pointing UP, the reverse of ownership.
 */
function ownerEdges(): Map<Function, OwnerEdge> {
    const edges = new Map<Function, OwnerEdge>();
    const conflicts: string[] = [];
    for (const owner of getRegisteredTypes()) {
        const ti = tryGetTypeInfo(owner);
        if (ti == undefined)
            continue;
        for (const fi of Object.values(ti.fields)) {
            if (fi.isBackReference || fi.noSerialize)
                continue;
            const targets = fi.typeInfos();
            if (targets.length !== 1)
                continue;   // polymorphic: not an owned-part edge we can name
            const part = targets[0]!.ctor;
            if (part == undefined || !isPartType(part))
                continue;
            const prev = edges.get(part);
            if (prev != undefined && (prev.owner !== owner || prev.member !== fi.name))
                conflicts.push(`${part.name}: ${prev.owner.name}.${prev.member} and ${owner.name}.${fi.name}`);
            edges.set(part, { owner, member: fi.name, collection: fi.array === true });
        }
    }
    for (const c of conflicts)
        SafeConsole.writeLineColor(chalk.yellow, `  WARNING multi-owner part (forbidden): ${c}`);
    return edges;
}

/** The owner-rooted (rootType, path) a part-rooted route becomes, chaining through parts of parts. */
function respell(part: Function, path: string, edges: Map<Function, OwnerEdge>): { root: Function; path: string } | undefined {
    let ctor = part, p = path;
    for (let guard = 0; guard < 20; guard++) {
        const edge = edges.get(ctor);
        if (edge == undefined)
            return undefined;   // nothing owns it — leave the row alone and report it
        const member = storedMemberName(edge.member);
        p = edge.collection ? `${member}/${p}` : `${member}.${p}`;
        ctor = edge.owner;
        if (!isPartType(ctor))
            return { root: ctor, path: p };
    }
    return undefined;   // cyclic ownership
}

interface RouteRow { id: number; path: string; root_type_id: number; }

/** Every table holding a `basics.property_route` foreign key (see PropertyRouteEntity's header). */
const CONSUMERS: { table: string; column: string }[] = [
    { table: "auth.rule_property", column: "resource_id" },
    { table: "help.type_help__property", column: "property_id" },
    { table: "tour.css_step", column: "property_id" },
    { table: "dynamic.dynamic_validation", column: "sub_entity_id" },
    { table: "translation.translated_instance", column: "property_route_id" },
];

async function main(): Promise<void> {
    // The schema TRAILS the code here by definition, so the startup caches collect their mismatches
    // instead of throwing — the same accommodation `sync` and every other migration makes.
    await StartParameters.withIgnoredDatabaseMismatches(() => Starter.start(process.env["EASTWIND_DB"]!));
    const connector = Connector.current();

    const edges = ownerEdges();

    // cleanName <-> type id straight from the database: TypeLogic's caches are not to be trusted against
    // a schema that trails the model.
    const typeRows = await connector.executeQuery(
        `SELECT id, clean_name FROM basics.type`) as { id: number; clean_name: string }[];
    const idByClean = new Map(typeRows.map(t => [t.clean_name, t.id]));
    const cleanById = new Map(typeRows.map(t => [t.id, t.clean_name]));

    const partIdToCtor = new Map<number, Function>();
    for (const ctor of getRegisteredTypes()) {
        if (!(ctor.prototype instanceof Entity) || !isPartType(ctor))
            continue;
        const id = idByClean.get(cleanTypeName(ctor));
        if (id != undefined)
            partIdToCtor.set(id, ctor);
    }

    let updated = 0, merged = 0, unresolved = 0;

    await Transaction.create(async () => {
        const rows = await connector.executeQuery(
            `SELECT id, path, root_type_id FROM basics.property_route ORDER BY id`) as RouteRow[];

        // The rows that already exist, so a re-spelling that collides MERGES instead of violating the
        // (path, root_type_id) unique index.
        const existing = new Map(rows.map(r => [`${r.root_type_id}|${r.path}`, r.id]));

        for (const row of rows) {
            const part = partIdToCtor.get(row.root_type_id);
            if (part == undefined)
                continue;   // not rooted at a part: nothing to do

            const respelled = respell(part, row.path, edges);
            const newRootId = respelled == undefined ? undefined : idByClean.get(cleanTypeName(respelled.root));
            if (respelled == undefined || newRootId == undefined) {
                unresolved++;
                SafeConsole.writeLineColor(chalk.yellow,
                    `  UNRESOLVED (${cleanById.get(row.root_type_id)}).${row.path} — `
                    + (respelled == undefined ? "no owner found" : `owner ${respelled.root.name} has no basics.type row`)
                    + "; the sync will DELETE it");
                continue;
            }

            const key = `${newRootId}|${respelled.path}`;
            const twin = existing.get(key);
            if (twin != undefined && twin !== row.id) {
                // The owner-rooted row is already there: repoint every consumer and drop the duplicate.
                for (const c of CONSUMERS)
                    if (await exists(c.table))
                        await connector.executeNonQuery(
                            `UPDATE ${c.table} SET ${c.column} = $1 WHERE ${c.column} = $2`, [twin, row.id]);
                await connector.executeNonQuery(`DELETE FROM basics.property_route WHERE id = $1`, [row.id]);
                merged++;
                console.log(`  merged (${cleanTypeName(part)}).${row.path} -> (${cleanTypeName(respelled.root)}).${respelled.path}`);
            } else {
                await connector.executeNonQuery(
                    `UPDATE basics.property_route SET path = $1, root_type_id = $2 WHERE id = $3`,
                    [respelled.path, newRootId, row.id]);
                existing.set(key, row.id);
                updated++;
                console.log(`  (${cleanTypeName(part)}).${row.path} -> (${cleanTypeName(respelled.root)}).${respelled.path}`);
            }
        }
    });

    SafeConsole.writeLineColor(unresolved === 0 ? chalk.green : chalk.yellow,
        `[migrate] ${updated} route(s) re-spelled, ${merged} merged, ${unresolved} unresolved — now run 'sync'.`);
    await connector.closeConnection();
}

async function exists(qualified: string): Promise<boolean> {
    const [schema, name] = qualified.split(".");
    const rows = await Connector.current().executeQuery(
        `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`, [schema, name]);
    return rows.length > 0;
}

void main();
