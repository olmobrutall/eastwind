// Verify the CLIENT-side cached-query executor against the DATABASE: for each real snapshot, ask the
// server and the executor the same question and compare the answers.
//
// This is the only honest test of the executor. It is a second query engine — filtering, grouping,
// aggregation, ordering — and "it compiles" says nothing about whether it computes the same numbers. The
// server is the ground truth, and every disagreement here would have been a dashboard quietly showing
// wrong figures.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeCachedQueries.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { UserHolder } from "@altea/altea/server/userHolder";
import { UserWithClaims } from "@altea/altea/data/security";
import { Serializer } from "@altea/altea/data/serializer";
import { Decimal } from "@altea/altea/data/basics";
import { parseQueryRequest, toWireResultTable } from "@altea/altea/server/queryServer";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import { SubTokensOptionsAll } from "@altea/altea/data/dynamicQuery/tokens/queryToken";
import type { QueryToken } from "@altea/altea/data/dynamicQuery/tokens/queryToken";
import type { QueryRequest as WireQueryRequest, ResultTable as WireResultTable } from "@altea/altea/data/dynamicQuery/queryRequest";
import { getCachedResultTable, CachedQueryError } from "@altea/altea-dashboard/client/CachedQueryExecutor";
import type { CachedQueryJS } from "@altea/altea-dashboard/data/CachedQuery";
import { DashboardEntity } from "@altea/altea-dashboard/data/Dashboard";
import { CachedQueryLogic } from "@altea/altea-dashboard/server/CachedQueryLogic.server";
import { FilePathEmbeddedLogic } from "@altea/altea-files/server/FilePathEmbeddedLogic.server";
import { UserEntity } from "@altea/altea-auth/data/User";

let pass = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

/**
 * Compare two result tables, comparing a lite by its key and a decimal by its value.
 *
 * `ordered` false compares them as SETS, which is what a GROUPED result needs: neither SQL nor the
 * executor promises an order for groups, so a row-by-row comparison there tests nothing real.
 */
function sameTable(a: WireResultTable, b: WireResultTable, ordered = true): string | null {
    if (a.rows.length !== b.rows.length)
        return `row count ${a.rows.length} vs ${b.rows.length}`;

    const cell = (v: unknown): string => {
        if (v == null) return "∅";
        const k = (v as { key?: () => string }).key;
        if (typeof k === "function") return k.call(v);
        // A Decimal, and the STRING a snapshot holds one as, are the same value: normalise both.
        const asNumber = typeof v === "number" || v instanceof Decimal ? String(v)
            : typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? new Decimal(v).toString()
                : undefined;
        if (asNumber != null) return asNumber;
        // A Temporal date and the ISO STRING a snapshot holds it as are the same wire value: the server
        // side here is read BEFORE serialisation (a Temporal object), the snapshot AFTER it (a string), so
        // both are normalised through toString. Only a plain object with no meaningful toString is dumped.
        const str = String(v);
        return str === "[object Object]" ? JSON.stringify(v) : str;
    };

    const linesA = a.rows.map(r => r.columns.map(cell).join("|"));
    const linesB = b.rows.map(r => r.columns.map(cell).join("|"));
    if (!ordered) { linesA.sort(); linesB.sort(); }

    for (let i = 0; i < linesA.length; i++)
        if (linesA[i] !== linesB[i])
            return `row ${i}: [${linesA[i]}] vs [${linesB[i]}]`;

    return null;
}

/** Run a wire request against the DATABASE and return its wire result table. */
async function fromServer(wire: WireQueryRequest): Promise<WireResultTable> {
    const request = parseQueryRequest(wire);
    const rt = await QueryLogic.queries.executeQueryAsync(request);
    return toWireResultTable(rt, wire);
}

/** The tokens a request mentions, which is what the executor needs to reason about them. */
function tokensOf(wire: WireQueryRequest): { [token: string]: QueryToken } {
    const queryName = QueryLogic.queries.tryGetQueryNameByKey(wire.queryKey)!;
    const result: { [token: string]: QueryToken } = {};
    const add = (s: string | undefined): void => {
        if (s != null) result[s] = QueryLogic.getToken(queryName, s, SubTokensOptionsAll);
    };
    wire.columns.forEach(c => add(c.token));
    wire.orders.forEach(o => add(o.token));
    const walk = (fs: typeof wire.filters): void => fs.forEach(f =>
        "filters" in f ? walk(f.filters) : add(f.token));
    walk(wire.filters);
    return result;
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);
    const system = (await table(UserEntity).filter(u => u.userName == "System").toArray())[0] as UserEntity;

    await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
        const db = (await table(DashboardEntity).toArray() as DashboardEntity[])[0];
        const rows = await CachedQueryLogic.getCachedQueries(db);
        console.log(`[probe] ${rows.length} snapshot(s)`);

        for (const cq of rows) {
            // Parsed through the entity Serializer, exactly as the browser must: a plain JSON.parse leaves
            // each lite a bare object with no `key()`, and every comparison in the executor would be by
            // object identity.
            const bytes = FilePathEmbeddedLogic.readAllBytesSync(cq.file);
            const snapshot = Serializer.parse(new TextDecoder().decode(bytes)) as CachedQueryJS;
            const wire = snapshot.queryRequest;
            const label = `${wire.queryKey}${wire.groupResults ? " (grouped)" : ""}`;
            const tokens = tokensOf(wire);

            // 1. IDENTITY — the snapshot's own request must reproduce the server's answer exactly.
            try {
                const mine = getCachedResultTable(snapshot, wire, tokens);
                const theirs = await fromServer(wire);
                const diff = sameTable(theirs, mine, /*ordered*/ !wire.groupResults);
                check(`${label} identity`, diff == null, diff ?? undefined);
            } catch (e) {
                check(`${label} identity`, false, String((e as CachedQueryError)?.message ?? e));
            }

            // 2. an EXTRA FILTER the snapshot did not apply — the executor must filter, and agree.
            const filterable = wire.columns.find(c => !tokens[c.token]?.isAggregate()
                && tokens[c.token]?.filterType === "String");
            if (filterable != null && !wire.groupResults) {
                const value = String(snapshot.resultTable.rows
                    .map(r => r.columns[snapshot.resultTable.columns.indexOf(filterable.token)])
                    .find(v => typeof v === "string" && v.length > 2) ?? "");
                if (value !== "") {
                    const narrowed: WireQueryRequest = {
                        ...wire,
                        filters: [...wire.filters, { token: filterable.token, operation: "EqualTo", value }],
                    };
                    try {
                        const mine = getCachedResultTable(snapshot, narrowed, tokens);
                        const theirs = await fromServer(narrowed);
                        const diff = sameTable(theirs, mine);
                        check(`${label} +filter ${filterable.token}=${value}`, diff == null, diff ?? undefined);
                    } catch (e) {
                        check(`${label} +filter`, false, String((e as CachedQueryError)?.message ?? e));
                    }
                }
            }

            // 3. a COUNT GROUPED BY the first key column — the path a cross-filtered chart takes.
            const keyCol = wire.columns.find(c => !tokens[c.token]?.isAggregate());
            if (keyCol != null && !wire.groupResults) {
                const queryName = QueryLogic.queries.tryGetQueryNameByKey(wire.queryKey)!;
                const countToken = QueryLogic.getToken(queryName, "Count", SubTokensOptionsAll);
                const grouped: WireQueryRequest = {
                    ...wire,
                    groupResults: true,
                    columns: [{ token: keyCol.token, displayName: keyCol.displayName }, { token: "Count", displayName: "Count" }],
                    orders: [],
                    pagination: { mode: "All" },
                };
                try {
                    const mine = getCachedResultTable(snapshot, grouped, { ...tokens, Count: countToken });
                    const theirs = await fromServer(grouped);
                    // Grouping order is not defined on either side, so compare as SETS.
                    const norm = (t: WireResultTable): string => t.rows
                        .map(r => r.columns.map(v => v == null ? "∅"
                            : typeof (v as { key?: () => string }).key === "function" ? (v as { key(): string }).key()
                                : String(v)).join("|"))
                        .sort().join("\n");
                    check(`${label} group by ${keyCol.token}`, norm(mine) === norm(theirs),
                        norm(mine) === norm(theirs) ? undefined : `${mine.rows.length} vs ${theirs.rows.length} groups`);
                } catch (e) {
                    check(`${label} group by ${keyCol.token}`, false, String((e as CachedQueryError)?.message ?? e));
                }
            }
        }
    });

    console.log(`[probe] ${pass} comparison(s) matched the database`);
    for (const f of failures)
        console.log("  MISMATCH " + f);

    await Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
