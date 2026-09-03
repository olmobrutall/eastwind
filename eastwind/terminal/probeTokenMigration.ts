// Token migrations: repair the query TOKENS stored inside user assets after a schema rename.
//
// The subsystem is worth probing at three levels, because each can fail independently:
//   1. the FILE is a contract — a `.tokens.json` must round-trip, and its bucket shapes and the
//      string-or-array encoding must be Signum's, or a database migrated between the two frameworks
//      loses its recorded history;
//   2. the RESOLUTION is the algorithm — a chain (V1: A→B, then V2: B→C) must land on C in one pass, an
//      older file must still be found under the name its key had at THAT file's era, and a
//      multi-candidate entry must try candidates until one resolves fully;
//   3. the REPAIR is the point — a stored UserQuery whose token no longer resolves must come out of an
//      Apply run with the token fixed, and an unrecorded miss must be an ERROR rather than a prompt,
//      since Apply runs where nobody is watching.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeTokenMigration.js
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { deleteList } from "@altea/altea/server/Database";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import { SubTokensOptions } from "@altea/altea/data/dynamicQuery/tokens/queryToken";
import { ColumnOptionsMode } from "@altea/altea/data/dynamicQueries";
import { TokenMigrationFile, appendValue, valuesOf } from "@altea/altea-user-assets/server/TokenMigrationFile.server";
import { TokenSyncContext } from "@altea/altea-user-assets/server/TokenSyncContext.server";
import { QueryTokenSynchronizer } from "@altea/altea-user-assets/server/QueryTokenSynchronizer.server";
import { TokenMigrationLogic } from "@altea/altea-user-assets/server/TokenMigrationLogic.server";
import { TokenMigrationEntity } from "@altea/altea-user-assets/data/TokenMigration";
import { QueryTokenEmbedded } from "@altea/altea-user-assets/data/Queries";
import { QueryEntity } from "@altea/altea/data/queryEntity";
import { UserQueryEntity, UserQueryEntity_Column } from "@altea/altea-user-queries/data/UserQuery";
import { OrderEntity } from "../orders/Order.data";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    check("the module is started", TokenMigrationLogic.isStarted());
    check("the four subscribers registered", TokenMigrationLogic.tokenSynchronizing.length === 4,
        TokenMigrationLogic.tokenSynchronizing.map(s => s.name).join(", "));

    // ---- 1. the FILE contract ---------------------------------------------------------------------
    const file = new TokenMigrationFile();
    file.getOrCreateTokenDictionary("Order", /* isQuery */ true)["OldName"] = "ShipName";
    file.getOrCreateDictionary("Types")["OldType"] = "NewType";
    file.getOrCreateDictionary("FilterValue", "Order|state")["Ordered"] = "Shipped";
    file.userAssetActions = [{ entityType: "UserQueryEntity", guid: "abc", action: "Delete" }];

    const json = file.toJson();
    // Signum's own property names, so a file written by either framework is read by both.
    check("the wire shape is Signum's",
        json.includes(`"tokensByQuery"`) && json.includes(`"types"`)
        && json.includes(`"filterValues"`) && json.includes(`"userAssetActions"`), json.slice(0, 120));
    // Absent buckets are OMITTED, not written as null (JsonIgnoreCondition.WhenWritingNull).
    check("empty buckets are omitted", !json.includes(`"members"`) && !json.includes(`"globals"`));

    const dir = mkdtempSync(join(tmpdir(), "probe-tokens-"));
    try {
        const path1 = join(dir, "2026.01.01-10.00.00_probe.tokens.json");
        writeFileSync(path1, json, "utf8");
        const reloaded = TokenMigrationFile.load(path1);
        check("a file round-trips", reloaded.toJson() === json);
        check("...and comes back as a real instance", reloaded.isEmpty === false);

        // The string-or-array encoding: one candidate is a bare STRING, several are an ARRAY.
        check("one candidate encodes as a string", typeof appendValue(undefined, "A") === "string");
        const two = appendValue(appendValue(undefined, "A"), "B");
        check("two candidates encode as an array", Array.isArray(two) && two.length === 2);
        check("appending a duplicate is a no-op", valuesOf(appendValue(two, "A")).length === 2);

        // ---- 2. RESOLUTION ------------------------------------------------------------------------
        const orderQuery = QueryLogic.toQueryName("Order");
        const options = SubTokensOptions.CanElement;

        // A CHAIN across two files: V1 renames to an intermediate name that no longer exists, V2 carries
        // it the rest of the way. Only the composition resolves, which is the point.
        const v1 = new TokenMigrationFile();
        v1.getOrCreateTokenDictionary("Order", true)["Renamed1"] = "Renamed2";
        const v2 = new TokenMigrationFile();
        v2.getOrCreateTokenDictionary("Order", true)["Renamed2"] = "shipName";

        const chained = new TokenSyncContext("Apply", [v1, v2], null);
        const chainFix = await QueryTokenSynchronizer.fixToken(chained, "Renamed1", orderQuery, options,
            { allowRemoveToken: false, allowReGenerate: false });
        check("a rename CHAIN resolves in one pass",
            chainFix.result === "Fix" && chainFix.token?.fullKey() === "shipName",
            `${chainFix.result} ${chainFix.token?.fullKey()}`);

        // Only the FIRST file: the intermediate name does not exist, so nothing resolves — which is what
        // makes the chain above meaningful rather than accidental.
        const halfway = new TokenSyncContext("Apply", [v1], null);
        let halfFailed = false;
        try {
            await QueryTokenSynchronizer.fixToken(halfway, "Renamed1", orderQuery, options,
                { allowRemoveToken: false, allowReGenerate: false });
        } catch { halfFailed = true; }
        check("half a chain does NOT resolve", halfFailed);

        // MULTI-CANDIDATE: the first candidate is a dead end, the second resolves. Signum tries them in
        // order and takes the first that resolves ALL the way.
        const multi = new TokenMigrationFile();
        multi.getOrCreateTokenDictionary("Order", true)["Ambiguous"] = ["NoSuchColumn", "shipName"];
        const multiCtx = new TokenSyncContext("Apply", [multi], null);
        const multiFix = await QueryTokenSynchronizer.fixToken(multiCtx, "Ambiguous", orderQuery, options,
            { allowRemoveToken: false, allowReGenerate: false });
        check("a multi-candidate entry tries until one resolves",
            multiFix.result === "Fix" && multiFix.token?.fullKey() === "shipName",
            `${multiFix.result} ${multiFix.token?.fullKey()}`);

        // ERA subkeys: newest → oldest, unwound through each file's `types`.
        const eraA = new TokenMigrationFile();
        const eraB = new TokenMigrationFile();
        eraB.getOrCreateDictionary("Types")["OldOrder"] = "Order";
        const eraCtx = new TokenSyncContext("Apply", [eraA, eraB], null);
        const eras = eraCtx.computeEraSubKeys("Order");
        check("era subkeys unwind a later type rename",
            eras[0] === "OldOrder" && eras[1] === "Order", JSON.stringify(eras));

        // APPLY mode must not prompt — an unrecorded token is an error.
        const empty = new TokenSyncContext("Apply", [], null);
        let applyThrew = false;
        try {
            await QueryTokenSynchronizer.fixToken(empty, "NoSuchToken", orderQuery, options,
                { allowRemoveToken: false, allowReGenerate: false });
        } catch { applyThrew = true; }
        check("Apply mode refuses to guess", applyThrew);
        check("Apply mode reports it cannot prompt", !empty.canPrompt);

        // A token that still resolves is left ALONE — the fast path that makes a pass over thousands of
        // assets cheap.
        check("a live token needs no work",
            QueryTokenSynchronizer.resolves("shipName", orderQuery, options));

        // ---- 3. an end-to-end REPAIR --------------------------------------------------------------
        // A stored UserQuery whose column token no longer resolves, plus a migration that says what it
        // became. After an Apply run the stored token must be the new one.
        TokenMigrationLogic.migrationsDirectory = () => dir;

        const created: UserQueryEntity[] = [];
        try {
            // The QueryEntity row is already seeded by the query synchronizer, so it is READ rather than
            // constructed (queryEntityFromKey is internal to the synchronizer).
            const orderQueryEntity = await ExecutionMode.global(async () =>
                await table(QueryEntity).filter(q => q.key == "Order").single() as QueryEntity);

            const uq = await ExecutionMode.global(async () => {
                const q = UserQueryEntity.create({
                    query: orderQueryEntity,
                    displayName: "probe token migration",
                    columnsMode: ColumnOptionsMode.Add,
                    columns: [UserQueryEntity_Column.create({
                        token: QueryTokenEmbedded.create({ tokenString: "ProbeStaleToken" }),
                    })],
                });
                await q.save();
                return q;
            });
            created.push(uq);

            check("the stored token is stale to begin with",
                !QueryTokenSynchronizer.resolves("ProbeStaleToken", orderQuery, options));

            // The migration that repairs it, written where the runner looks.
            const repair = new TokenMigrationFile();
            repair.getOrCreateTokenDictionary("Order", true)["ProbeStaleToken"] = "shipName";
            const repairPath = join(dir, "2026.02.02-11.00.00_repair.tokens.json");
            repair.save(repairPath);

            const listed = TokenMigrationLogic.readMigrationsDirectory(true);
            check("the runner lists the migration files", listed.length >= 2, String(listed.length));
            check("...and reads their version and kind",
                listed.some(l => l.version === "2026.02.02-11.00.00" && l.kind === "Tokens"),
                listed.map(l => `${l.version}[${l.kind}]`).join(", "));

            // Apply it the way the runner does: one fire over every subscriber.
            await TokenMigrationLogic.fireTokenSynchronizing(
                new TokenSyncContext("Apply", [repair], null));

            const after = await ExecutionMode.global(async () =>
                await table(UserQueryEntity).filter(u => u.id == uq.id).single() as UserQueryEntity);
            check("the stored token was REPAIRED",
                after.columns[0]?.token.tokenString === "shipName",
                String(after.columns[0]?.token.tokenString));

            // A second run is a no-op: the token now resolves, so nothing is asked and nothing changes.
            await TokenMigrationLogic.fireTokenSynchronizing(
                new TokenSyncContext("Apply", [repair], null));
            const twice = await ExecutionMode.global(async () =>
                await table(UserQueryEntity).filter(u => u.id == uq.id).single() as UserQueryEntity);
            check("re-applying changes nothing", twice.columns[0]?.token.tokenString === "shipName");
        } finally {
            await ExecutionMode.global(async () => {
                await deleteList(created);
                await deleteList(await table(TokenMigrationEntity).toArray() as TokenMigrationEntity[]);
            });
        }

        // A `.query.json` written by the migration hook carries only the `types` bucket.
        const queryOnly = TokenMigrationFile.load(path1);
        check("a loaded file keeps its types bucket",
            queryOnly.types?.["OldType"] === "NewType", JSON.stringify(queryOnly.types));
        check("the file on disk is what we wrote", readFileSync(path1, "utf8") === json);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }

    console.log(`\n[tokenmigration] ${pass} checks passed`);
    for (const f of failures)
        console.log("  FAILED " + f);

    await Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
