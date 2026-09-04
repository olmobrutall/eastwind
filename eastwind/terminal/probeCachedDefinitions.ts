// Print what the SERVER decides each cached snapshot must contain — the definitions, their column
// expansion inside an interaction group, and how they combine.
//
// The expansion is the part of the feature no test can see from outside: a snapshot must carry a column for
// every token a SIBLING part can cross-filter by, or the browser is asked to filter by something the file
// does not hold ("Unable to filter X, column not found").
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeCachedDefinitions.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { UserHolder } from "@altea/altea/server/userHolder";
import { UserWithClaims } from "@altea/altea/data/security";
import { getKey as getQueryKey } from "@altea/altea/data/dynamicQuery/queryUtils";
import { DashboardEntity } from "@altea/altea-dashboard/data/Dashboard";
import { partConfigs } from "@altea/altea-dashboard/server/DashboardLogic";
import {
    getCachedQueryDefinitions, combineCachedQueryDefinitions,
} from "@altea/altea-dashboard/server/CachedQueryDefinitions";
import type { DashboardEntity_Part } from "@altea/altea-dashboard/data/Dashboard";
import type { CachedQueryDefinition } from "@altea/altea-dashboard/server/CachedQueryDefinitions";
import { UserEntity } from "@altea/altea-auth/data/User";

function definitionsOfPart(part: DashboardEntity_Part): CachedQueryDefinition[] {
    const config = partConfigs().find(c => part.content instanceof c.type);
    return config?.getCachedQueryDefinitions?.(part.content, part) ?? [];
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);
    const system = (await table(UserEntity).filter(u => u.userName == "System").toArray())[0] as UserEntity;

    await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
        const db = (await table(DashboardEntity).toArray() as DashboardEntity[])[0];

        // Build each part's definitions ONCE and hand the same objects to getCachedQueryDefinitions:
        // the expansion MUTATES them, so calling the provider twice would compare two unrelated sets and
        // report no expansion at all.
        const perPart = new Map((db.parts ?? []).map(part => [part, definitionsOfPart(part)] as const));
        const raw = [...perPart.values()].flat();
        const before = new Map(raw.map(d => [d, d.queryRequest.columns.map(c => c.token.fullKey()).join(", ")]));

        const defs = getCachedQueryDefinitions(db, part => perPart.get(part) ?? []);

        console.log(`[definitions] ${raw.length} part queries, ${defs.length} cached`);
        for (const d of raw) {
            const after = d.queryRequest.columns.map(c => c.token.fullKey()).join(", ");
            const b = before.get(d)!;
            console.log(`\n  ${d.userAsset.toString()}`);
            console.log(`     query=${getQueryKey(d.queryRequest.queryName)} group=${d.panelPart.interactionGroup}`
                + ` writer=${d.canWriteFilters} cached=${d.isQueryCached} grouped=${d.queryRequest.groupResults}`);
            console.log(`     columns : ${b}`);
            if (after !== b)
                console.log(`     EXPANDED: ${after}`);
        }

        const combined = combineCachedQueryDefinitions(defs);
        console.log(`\n[combined] ${combined.length} snapshot(s):`);
        for (const c of combined)
            console.log(`   ${getQueryKey(c.queryRequest.queryName)}`
                + ` [${c.queryRequest.columns.map(col => col.token.fullKey()).join(", ")}]`
                + ` for ${c.userAssets.map(a => a.toString()).join(" + ")}`);
    });

    await Connector.current().closeConnection();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
