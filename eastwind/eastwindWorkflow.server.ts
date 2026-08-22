import { Temporal, toInt } from "@altea/altea/data/basics";
import { Decimal } from "@altea/altea/data/basics";
import { Lite } from "@altea/altea/data/lite";
import type { Entity } from "@altea/altea/data/entity";
import type { SchemaBuilder } from "@altea/altea/server/schema";
import { table } from "@altea/altea/server/table";
import { UserEntity } from "@altea/altea-auth/data/User";
import { RoleEntity } from "@altea/altea-auth/data/Role";
import { WorkflowConfigurationEmbedded } from "@altea/altea-workflow/data/Workflow";
import { WorkflowLogic } from "@altea/altea-workflow/server/WorkflowLogic.server";
// A side-effect import, for the FluentInclude augmentation (`withWorkflow` / `withCaseActivityMixin`): a
// `declare module` only reaches a program that loads the declaring file, and nothing else here imports it.
// Signum's C# equivalent is the `using Signum.Workflow;` an extension method needs.
import "@altea/altea-workflow/server/CaseActivityLogic.server";
import { Operations } from "@altea/altea/server/operationLogic";
import { EmailMessageEntity } from "@altea/altea-email/data/EmailMessage";
import { OrderEntity, OrderOperation, OrderState } from "./orders/Order.data";
import { EastwindWorkflowSymbols } from "./eastwindWorkflowSymbols.data";

// eastwind's side of the workflow module (@altea/altea-workflow).
//
// Southwind only calls `WorkflowLogicStarter.Start(sb, () => Configuration.Value.Workflow)` and never declares
// a case MAIN ENTITY, so its workflow tables exist but nothing can actually run through them. eastwind goes one
// step further and makes ORDER a main entity, plus registers the small set of condition / action / lane-actor
// hooks a demo workflow needs — otherwise the port is unverifiable end to end.
//
// Two things follow from altea's Eval divergence (see altea-workflow/data/WorkflowEval.ts): the hooks are
// code-declared SYMBOLS (declared in ./eastwindWorkflowSymbols.data.ts, so both tiers see them) with the
// implementation registered here, and a designer picks one from a dropdown instead of typing C#.

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

    /** Registers the app's evaluators. Called from the starter AFTER WorkflowLogicStarter.start. */
    export function registerEvaluators(): void {

        // ---- Conditions ("may this connection be taken?") ---------------------------------------------
        WorkflowLogic.registerCondition(EastwindWorkflowSymbols.OrderIsLarge,
            mainEntity => (mainEntity as OrderEntity).totalPrice().greaterThan(1000));

        WorkflowLogic.registerCondition(EastwindWorkflowSymbols.OrderIsShipped,
            mainEntity => (mainEntity as OrderEntity).state === OrderState.Shipped);

        // ---- Actions (a side effect while taking a connection) ----------------------------------------
        WorkflowLogic.registerAction(EastwindWorkflowSymbols.ShipOrder, async mainEntity => {
            const order = mainEntity as OrderEntity;
            if (order.state === OrderState.Ordered)
                await Operations.execute(order, OrderOperation.Ship);
        });

        WorkflowLogic.registerAction(EastwindWorkflowSymbols.CancelOrder, async mainEntity => {
            const order = mainEntity as OrderEntity;
            if (order.state !== OrderState.Canceled)
                await Operations.execute(order, OrderOperation.Cancel);
        });

        // ---- Lane actors (who is notified, computed per case) -----------------------------------------
        // The order's own employee, so a case follows whoever took it. `mainEntity` is null when the lane is
        // asked who may START the workflow — there every user of the lane's role would be wrong to compute
        // here, so the lane's static actor list covers that case and this answers nobody.
        WorkflowLogic.registerLaneActors(EastwindWorkflowSymbols.OrderEmployee, mainEntity => {
            const employee = mainEntity == null ? null : (mainEntity as OrderEntity).employee;
            return employee == null ? [] : [employee as unknown as Lite<Entity>];
        });

        // Every user in the role the order's territory implies — the "compute the audience" case a static
        // actor list cannot express. Kept deliberately simple: all users of the Administrators role.
        WorkflowLogic.registerLaneActors(EastwindWorkflowSymbols.AllAdministrators, async () => {
            const role = await table(RoleEntity).filter(r => r.name === "Administrators").firstOrNull();
            if (role == null)
                return [];

            const users = await table(UserEntity).filter(u => u.role.is(role)).toArray();
            return users.map(u => u.toLite() as unknown as Lite<Entity>);
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
