import { Temporal, toInt } from "@altea/altea/data/basics";
import { Decimal } from "@altea/altea/data/basics";
import type { SchemaBuilder } from "@altea/altea/server/schema";
import { WorkflowConfigurationEmbedded } from "@altea/altea-workflow/data/Workflow";
// A side-effect import, for the FluentInclude augmentation (`withWorkflow` / `withCaseActivityMixin`): a
// `declare module` only reaches a program that loads the declaring file, and nothing else here imports it.
// Signum's C# equivalent is the `using Signum.Workflow;` an extension method needs.
import "@altea/altea-workflow/server/CaseActivityLogic.server";
import { Operations } from "@altea/altea/server/operationLogic";
import { EmailMessageEntity } from "@altea/altea-email/data/EmailMessage";
import { OrderEntity, OrderOperation, OrderState } from "./orders/Order.data";

// eastwind's side of the workflow module (@altea/altea-workflow).
//
// Southwind only calls `WorkflowLogicStarter.Start(sb, () => Configuration.Value.Workflow)` and never declares
// a case MAIN ENTITY, so its workflow tables exist but nothing can actually run through them. eastwind goes one
// step further and makes ORDER a main entity, plus registers the small set of condition / action / lane-actor
// hooks a demo workflow needs — otherwise the port is unverifiable end to end.
//
// The condition / action / lane-actor hooks themselves are no longer code: they are stored SCRIPTS an
// administrator types into the designer, compiled by @altea/altea-eval — see ./eastwindEval.server.ts for
// what such a script may import.

export namespace EastwindWorkflow {

    /** The module's settings. Southwind reads them off its persisted ApplicationConfiguration; eastwind has no
     *  such entity, so they come from the environment with Signum's own defaults (`EASTWIND_WORKFLOW_*`). */
    let cached: WorkflowConfigurationEmbedded | undefined;

    export function configuration(): WorkflowConfigurationEmbedded {
        return cached ??= WorkflowConfigurationEmbedded.create({
            scriptRunnerPeriod: toInt(Number(process.env["EASTWIND_WORKFLOW_SCRIPT_PERIOD"] ?? 5 * 60)),
            avoidExecutingScriptsOlderThan: null,
            chunkSizeRunningScripts: toInt(100),
        });
    }

    /**
     * Makes ORDER a case main entity (Signum's `sb.Include<OrderEntity>().WithWorkflow(…)`).
     *
     * Called from OrdersLogic's include point would be cleaner, but the workflow module is started much later
     * than the domains (it needs auth, the scheduler and processes), so this re-opens the include the way
     * Signum's own extension modules do.
     */
    export function registerOrderAsMainEntity(sb: SchemaBuilder): void {
        // The other half of the CaseActivityMixin declaration in entityOverrides: the preSaving hook that
        // tags whatever an activity produces with the activity it came from.
        sb.include(EmailMessageEntity).withCaseActivityMixin();

        sb.include(OrderEntity).withWorkflow({
            // NOT `new OrderEntity()`: `state` has no initializer (Signum leans on C#'s enum default) and
            // altea's implicit NotNull validator rejects an unset field, so the order would fail validation
            // before the user could touch it. Not `Operations.construct(OrderOperation.Create)` either — that
            // one demands a `currentEmployee()`, which a workflow may well be started by a user who is not an
            // employee. `customer` / `employee` stay unset on purpose: the case's first activity is the form
            // where they are filled.
            constructor: () => OrderEntity.create({
                state: OrderState.New,
                orderDate: Temporal.Now.plainDateISO(),
                requiredDate: Temporal.Now.plainDateISO().add({ days: 3 }),
                freight: new Decimal(0),
            }),
            saveEntity: async (order: OrderEntity) => { await Operations.execute(order, OrderOperation.Save); },
            cancel: async (order: OrderEntity) => {
                if (order.state !== OrderState.Canceled)
                    await Operations.execute(order, OrderOperation.Cancel);
            },
        });
    }
}
