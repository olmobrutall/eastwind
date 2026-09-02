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
import { DashboardEntity, DashboardOperation, CacheQueryConfigurationEmbedded } from "@altea/altea-dashboard/data/Dashboard";
import { CachedQueryEntity } from "@altea/altea-dashboard/data/CachedQuery";
import { CachedQueryLogic } from "@altea/altea-dashboard/server/CachedQueryLogic.server";
import { UserQueryPartEntity, ValueUserQueryListPartEntity } from "@altea/altea-user-queries/data/DashboardParts";
import { UserChartPartEntity, CombinedUserChartPartEntity } from "@altea/altea-chart/data/DashboardParts";
import { UserEntity } from "@altea/altea-auth/data/User";
import { UserWithClaims } from "@altea/altea/data/security";

async function main(): Promise<void> {
    const connStr = process.env["EASTWIND_DB"]!;
    await Starter.start(connStr);

    // The regeneration runs queries and saves rows, so it needs a user in scope; every part's query is
    // also row-filtered by that user's role, which is exactly how it will run in production.
    const system = (await table(UserEntity).filter(u => u.userName == "System").toArray())[0] as UserEntity;

    await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
        const db = (await table(DashboardEntity).toArray() as DashboardEntity[])[0];
        if (db == null)
            throw new Error("no dashboard found — run `terminal csharp` first");

        console.log(`[configure] ${db.displayName} (${db.parts?.length ?? 0} parts)`);

        // 1. the dashboard opts in to snapshots. The defaults are Signum's (5 min, 1e6 rows), and only
        //    maxRows is actually consulted (see the entity on timeoutForQueries).
        db.cacheQueryConfiguration = CacheQueryConfigurationEmbedded.create({ maxRows: 100000 as int });

        // 2. every part with a query asks to be served from the snapshot.
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
