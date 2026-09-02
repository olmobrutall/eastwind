// The end-to-end truth test for cached dashboards: for EACH PART, ask its own question of the snapshot the
// server assigned it, and compare with the database.
//
// probeCachedQueries replays a snapshot's OWN stored request, which proves the executor computes what the
// file was built from. This asks the question the dashboard actually asks — a part's own columns, which
// after combining are a SUBSET of the snapshot's, at a grain the snapshot may have widened. That is where a
// caching design can be right in every step and still put a different number on the screen, so it is the
// comparison worth making.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeCachedParts.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { UserHolder } from "@altea/altea/server/userHolder";
import { UserWithClaims } from "@altea/altea/data/security";
import { Serializer } from "@altea/altea/data/serializer";
import { Decimal } from "@altea/altea/data/basics";
import { parseQueryRequest, toWireQueryRequest, toWireResultTable } from "@altea/altea/server/queryServer";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import { SubTokensOptionsAll } from "@altea/altea/data/dynamicQuery/tokens/queryToken";
import type { QueryToken } from "@altea/altea/data/dynamicQuery/tokens/queryToken";
import type { QueryRequest as WireQueryRequest, ResultTable as WireResultTable } from "@altea/altea/data/dynamicQuery/queryRequest";
import { getCachedResultTable, CachedQueryError } from "@altea/altea-dashboard/client/CachedQueryExecutor";
import type { CachedQueryJS } from "@altea/altea-dashboard/data/CachedQuery";
import { DashboardEntity, type DashboardEntity_Part } from "@altea/altea-dashboard/data/Dashboard";
import { partConfigs } from "@altea/altea-dashboard/server/DashboardLogic.server";
import { CachedQueryLogic } from "@altea/altea-dashboard/server/CachedQueryLogic.server";
import type { CachedQueryDefinition } from "@altea/altea-dashboard/server/CachedQueryDefinitions.server";
import { FilePathEmbeddedLogic } from "@altea/altea-files/server/FilePathEmbeddedLogic.server";
import { UserEntity } from "@altea/altea-auth/data/User";

function definitionsOfPart(part: DashboardEntity_Part): CachedQueryDefinition[] {
    const config = partConfigs().find(c => part.content instanceof c.type);
    return config?.getCachedQueryDefinitions?.(part.content, part) ?? [];
}

/** Every token a request mentions, which is what the executor reasons about it with. */
function tokensOf(wire: WireQueryRequest): { [token: string]: QueryToken } {
    const queryName = QueryLogic.queries.tryGetQueryNameByKey(wire.queryKey)!;
    const result: { [token: string]: QueryToken } = {};
    const add = (s: string | undefined): void => {
        if (s != null) result[s] = QueryLogic.getToken(queryName, s, SubTokensOptionsAll);
    };
    wire.columns.forEach(c => add(c.token));
    wire.orders.forEach(o => add(o.token));
    const walk = (fs: typeof wire.filters): void => fs.forEach(f => "filters" in f ? walk(f.filters) : add(f.token));
    walk(wire.filters);
    return result;
}

const cell = (v: unknown): string => {
    if (v == null) return "∅";
    const k = (v as { key?: () => string }).key;
    if (typeof k === "function") return k.call(v);
    if (typeof v === "number" || v instanceof Decimal) return String(v);
    if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return new Decimal(v).toString();
    const str = String(v);
    return str === "[object Object]" ? JSON.stringify(v) : str;
};

/** The rows as a MULTISET — a grouped answer has no defined order on either side. */
function rowsOf(t: WireResultTable): string[] {
    return t.rows.map(r => r.columns.map(cell).join("|")).sort();
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);
    const system = (await table(UserEntity).filter(u => u.userName == "System").toArray())[0] as UserEntity;

    await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
        const db = (await table(DashboardEntity).toArray() as DashboardEntity[])[0];

        // Each part's OWN request, built fresh so the column expansion has not touched it — this is what
        // the browser sends (or would send, uncached).
        const own = (db.parts ?? []).flatMap(definitionsOfPart).filter(d => d.isQueryCached);

        // The snapshots as stored, keyed by the assets each one answers for.
        const stored = await CachedQueryLogic.getCachedQueries(db);
        const byAsset = new Map<string, CachedQueryJS>();
        for (const cq of stored) {
            const snapshot = Serializer.parse(
                new TextDecoder().decode(FilePathEmbeddedLogic.readAllBytesSync(cq.file))) as CachedQueryJS;
            for (const row of cq.userAssets ?? [])
                if (row.userAsset != null)
                    byAsset.set(row.userAsset.key(), snapshot);
        }

        console.log(`[parts] ${own.length} cached part queries over ${stored.length} snapshot(s)\n`);

        let pass = 0;
        const failures: string[] = [];

        for (const d of own) {
            const name = d.userAsset.toString();
            const snapshot = byAsset.get(d.userAsset.key());
            if (snapshot == null) {
                failures.push(`${name}: no snapshot covers this asset`);
                continue;
            }

            const wire = toWireQueryRequest(d.queryRequest);
            try {
                const mine = getCachedResultTable(snapshot, wire, tokensOf(wire));
                const theirs = toWireResultTable(
                    await QueryLogic.queries.executeQueryAsync(parseQueryRequest(wire)), wire);

                const a = rowsOf(theirs);
                const b = rowsOf(mine);
                if (a.length !== b.length) {
                    failures.push(`${name}: ${a.length} rows from the database, ${b.length} from the snapshot`);
                } else {
                    const i = a.findIndex((x, j) => x !== b[j]);
                    if (i === -1) { pass++; console.log(`  OK   ${name} (${a.length} rows)`); }
                    else failures.push(`${name}: row ${i} [${a[i]}] from the database vs [${b[i]}] from the snapshot`);
                }
            } catch (e) {
                failures.push(`${name}: ${String((e as CachedQueryError)?.message ?? e)}`);
            }
        }

        console.log(`\n[parts] ${pass}/${own.length} parts answer from their snapshot exactly as from the database`);
        for (const f of failures)
            console.log("  MISMATCH " + f);

        process.exitCode = failures.length === 0 ? 0 : 1;
    });

    await Connector.current().closeConnection();
}

main().catch(e => { console.error(e); process.exit(1); });
