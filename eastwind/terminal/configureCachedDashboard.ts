// Configure the seeded dashboard for SNAPSHOTS and regenerate them — the end-to-end exercise of
// @altea/altea-dashboard's cached-query feature, which no test suite can reach (it needs a dashboard with
// real parts over real data).
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/configureCachedDashboard.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { table } from "@altea/altea/server/table";
import { Operations } from "@altea/altea/server/operationLogic";
import { UserHolder } from "@altea/altea/server/userHolder";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { type int } from "@altea/altea/data/basics";
import { DashboardEntity, DashboardOperation, CacheQueryConfigurationEmbedded, InteractionGroup } from "@altea/altea-dashboard/data/Dashboard";
import { CachedQueryEntity } from "@altea/altea-dashboard/data/CachedQuery";
import { CachedQueryLogic } from "@altea/altea-dashboard/server/CachedQueryLogic";
import { partConfigs } from "@altea/altea-dashboard/server/DashboardLogic";
import type { CachedQueryDefinition } from "@altea/altea-dashboard/server/CachedQueryDefinitions";
import type { DashboardEntity_Part } from "@altea/altea-dashboard/data/Dashboard";
import { UserQueryPartEntity, ValueUserQueryListPartEntity } from "@altea/altea-user-queries/data/DashboardParts";
import { UserChartPartEntity, CombinedUserChartPartEntity } from "@altea/altea-chart/data/DashboardParts";
import { UserEntity } from "@altea/altea-auth/data/User";
import { UserWithClaims } from "@altea/altea/data/security";

function definitionsOfPart(part: DashboardEntity_Part): CachedQueryDefinition[] {
    const config = partConfigs().find(c => part.content instanceof c.type);
    return config?.getCachedQueryDefinitions?.(part.content, part) ?? [];
}

async function main(): Promise<void> {
    const connStr = process.env["EASTWIND_DB"]!;
    await Starter.start(connStr);

    // The regeneration runs queries and saves rows, so it needs a user in scope; every part's query is
    // also row-filtered by that user's role, which is exactly how it will run in production.
    const system = (await table(UserEntity).filter(u => u.userName == "System").toArray())[0] as UserEntity;

    await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
        const db = (await table(DashboardEntity).toArray() as DashboardEntity[])[0];
        if (db == null)
            throw new Error("no dashboard found — run `terminal ts` first");

        console.log(`[configure] ${db.displayName} (${db.parts?.length ?? 0} parts)`);

        // 1. the dashboard opts in to snapshots. The defaults are Signum's (5 min, 1e6 rows), and only
        //    maxRows is actually consulted (see the entity on timeoutForQueries).
        db.cacheQueryConfiguration = CacheQueryConfigurationEmbedded.create({ maxRows: 100000 as int });

        // 2. one part is moved out of its interaction group before anything is cached.
        //
        //    Inside an interaction group the server gives every part a column for each token its siblings
        //    can cross-filter by — that is what lets a click re-filter the others with no request. For a
        //    GROUPED part those columns become GROUP KEYS, so one sibling whose query walks a COLLECTION
        //    (`details.Element.…`) turns everyone's rows from one-per-order into one-per-order-LINE, and a
        //    Count or Sum re-aggregated from that counts lines. Measured on this dashboard: "Order number
        //    by month" read 76 where the database says 33.
        //
        //    Un-caching that part does NOT help — the expansion deliberately considers uncached parts too,
        //    since one can still publish a filter — so the lever is the GROUP. Product Share moves to its
        //    own; it keeps its own snapshot and loses only its cross-filtering into the order-grain parts.
        //    Group 1's two parts both walk the collection, so they agree already and stay together.
        //
        //    This follows from the expansion logic as Signum writes it: mixing grains in one interaction
        //    group is a configuration hazard, not something the port introduced.
        const walksCollection = (part: DashboardEntity_Part): boolean =>
            definitionsOfPart(part).some(d => d.queryRequest.groupResults
                && d.queryRequest.columns.some(c => c.token.hasElement()));

        const byGroup = new Map<number, DashboardEntity_Part[]>();
        for (const part of db.parts ?? [])
            if (part.interactionGroup != null)
                byGroup.set(part.interactionGroup as number,
                    [...byGroup.get(part.interactionGroup as number) ?? [], part]);

        let spare = InteractionGroup.Group8;
        for (const [, parts] of byGroup) {
            const odd = parts.filter(walksCollection);
            if (odd.length === 0 || odd.length === parts.length)
                continue; // every part agrees on the grain — nothing to separate
            for (const part of odd) {
                part.interactionGroup = spare--;
                console.log(`[configure] moved out of its interaction group (collection grain): ${part.content}`);
            }
        }

        // 3. every part with a query asks to be served from the snapshot.
        let flagged = 0;
        for (const part of db.parts ?? []) {
            const content = part.content;
            if (content instanceof UserQueryPartEntity || content instanceof UserChartPartEntity) {
                content.isQueryCached = true;
                flagged++;
            } else if (content instanceof CombinedUserChartPartEntity) {
                for (const row of content.userCharts ?? []) { row.isQueryCached = true; flagged++; }
            } else if (content instanceof ValueUserQueryListPartEntity) {
                for (const row of content.userQueries ?? []) { row.isQueryCached = true; flagged++; }
            }
        }
        console.log(`[configure] ${flagged} cacheable part queries flagged`);

        await Operations.execute(db, DashboardOperation.Save);

        // 3. build the snapshots.
        const started = Date.now();
        await Operations.execute(db, DashboardOperation.RegenerateCachedQueries);
        console.log(`[regenerate] done in ${Date.now() - started} ms`);

        // 4. report what it produced.
        const rows = await CachedQueryLogic.getCachedQueries(db);
        console.log(`[regenerate] ${rows.length} snapshot(s) for ${flagged} part queries:`);
        for (const cq of rows)
            console.log(`   ${cq.numRows} rows x ${cq.numColumns} cols  query=${cq.queryDuration}ms `
                + `upload=${cq.uploadDuration}ms  assets=${(cq.userAssets ?? []).length}  ${cq.file?.fileName}`);
    });

    await Connector.current().closeConnection();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
