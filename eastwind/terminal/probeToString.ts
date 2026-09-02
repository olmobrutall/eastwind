// A one-shot verification for the `@quoted toString()` change: force each affected type's toString into
// SQL with a PROJECTION (`map(e => e.toString())`) and report whether the provider could lower it.
//
// This exists because a wrongly-`@quoted` body compiles fine and fails only when a query touches it — so
// "it builds" proves nothing. A projection is the strictest form: the expression must translate on its
// own, with no ToStr column to fall back on.
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { StartParameters } from "@altea/altea/data/utils/startParameters";
import { table } from "@altea/altea/server/table";
import type { Entity, Type } from "@altea/altea/data/entity";

import { HolidayCalendarEntity } from "@altea/altea-scheduler/data/HolidayCalendar";
import { ToolbarEntity, ToolbarMenuEntity, ToolbarSwitcherEntity } from "@altea/altea-toolbar/data/Toolbar";
import { WorkflowEntity } from "@altea/altea-workflow/data/Workflow";
import {
    WorkflowActivityEntity, WorkflowLaneEntity, WorkflowPoolEntity,
    WorkflowEventEntity, WorkflowGatewayEntity, WorkflowConnectionEntity,
} from "@altea/altea-workflow/data/WorkflowNodes";
import { WorkflowScriptEntity, WorkflowScriptRetryStrategyEntity } from "@altea/altea-workflow/data/WorkflowScript";
import { WorkflowTimerConditionEntity } from "@altea/altea-workflow/data/WorkflowTimerCondition";
import { WorkflowConditionEntity } from "@altea/altea-workflow/data/WorkflowCondition";
import { WorkflowActionEntity } from "@altea/altea-workflow/data/WorkflowAction";
import { CaseTagTypeEntity } from "@altea/altea-workflow/data/Case";
import { UserQueryPartEntity, BigValuePartEntity } from "@altea/altea-user-queries/data/DashboardParts";
import { UserChartPartEntity } from "@altea/altea-chart/data/DashboardParts";
import { TypeHelpEntity, NamespaceHelpEntity, QueryHelpEntity, HelpImageEntity } from "@altea/altea-help/data/Help";
import { RestApiKeyEntity } from "@altea/altea-rest/data/Rest";

const types: Type<Entity>[] = [
    HolidayCalendarEntity, ToolbarEntity, ToolbarMenuEntity, ToolbarSwitcherEntity,
    WorkflowEntity, WorkflowActivityEntity, WorkflowLaneEntity, WorkflowPoolEntity,
    WorkflowEventEntity, WorkflowGatewayEntity, WorkflowConnectionEntity,
    WorkflowScriptEntity, WorkflowScriptRetryStrategyEntity, WorkflowTimerConditionEntity,
    WorkflowConditionEntity, WorkflowActionEntity, CaseTagTypeEntity,
    UserQueryPartEntity, BigValuePartEntity, UserChartPartEntity,
    TypeHelpEntity, NamespaceHelpEntity, QueryHelpEntity, HelpImageEntity,
    RestApiKeyEntity,
];

async function main(): Promise<void> {
    const connStr = process.env["EASTWIND_DB"] ?? process.env["ALTEA_TEST_DB"]!;
    await StartParameters.withIgnoredDatabaseMismatches(() => Starter.start(connStr));

    let ok = 0;
    const failed: string[] = [];
    for (const t of types) {
        try {
            await table(t).map(e => e.toString()).toArray();
            ok++;
        } catch (e) {
            failed.push(`${t.name}: ${(e as Error)?.message?.split("\n")[0] ?? e}`);
        }
    }

    console.log(`[probe] ${ok}/${types.length} toString projections lowered to SQL`);
    for (const f of failed)
        console.log("  FAILED " + f);

    await Connector.current().closeConnection();
    process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
