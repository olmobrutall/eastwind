import { Temporal } from "@altea/altea/data/basics";
import { Decimal } from "@altea/altea/data/basics";
import type { SchemaBuilder } from "@altea/altea/server/schema";
// A side-effect import, for the FluentInclude augmentation (`withWorkflow` / `withCaseActivityMixin`): a
// `declare module` only reaches a program that loads the declaring file, and nothing else here imports it.
// The import is what brings the workflow extension methods into scope.
import "@altea/altea-workflow/server/CaseActivityLogic";
import { CaseActivityMixin } from "@altea/altea-workflow/data/CaseActivity";
import { Operations } from "@altea/altea/server/operationLogic";
import { EmailMessageEntity } from "@altea/altea-email/data/EmailMessage";
import { OrderEntity, OrderOperation, OrderState } from "./Order.data";

// The ORDERS domain's side of the workflow module (@altea/altea-workflow) — this file lives in `orders/`
// because that is where a domain's module wiring belongs (its process algorithms and scheduled tasks
// live in OrderLogic.server.ts), and because everything here is about ORDER.
//
// A legacy database starts the module but never declares
// a case MAIN ENTITY, so its workflow tables exist but nothing can actually run through them. eastwind goes one
// step further and makes ORDER a main entity, plus registers the small set of condition / action / lane-actor
// hooks a demo workflow needs — otherwise the port is unverifiable end to end. The module's SETTINGS are not
// here: they live on the ApplicationConfiguration row, which the starter hands to the module as a lambda
// (`() => Starter.configuration.value().thenTyped(c => c.workflow)`).
//
// The condition / action / lane-actor hooks themselves are no longer code: they are stored SCRIPTS an
// administrator types into the designer, compiled by @altea/altea-eval — see ../eastwindEval.server.ts for
// what such a script may import.
//
// It is NOT called from OrdersLogic.start: the workflow module starts much later than the domains (it needs
// auth, the scheduler and processes), so the starter calls it at the right point — the one thing about this
// registration that cannot move into the domain's own start.

export namespace OrderWorkflow {

    /**
     * Makes ORDER a case main entity.
     *
     * Called from OrdersLogic's include point would be cleaner, but the workflow module is started much later
     * than the domains (it needs auth, the scheduler and processes), so this re-opens the include the way
     * an extension module would.
     */
    export function registerOrderAsMainEntity(sb: SchemaBuilder): void {
        // The other half of the CaseActivityMixin declaration in entityOverrides: the preSaving hook that
        // tags whatever an activity produces with the activity it came from. It is a NO-OP unless the mixin
        // is declared, which under legacyMode it is not — asking for the hook
        // then would fail on a mixin the entity does not have.
        if (CaseActivityMixin.isDeclaredOn(EmailMessageEntity))
            sb.include(EmailMessageEntity).withCaseActivityMixin();

        sb.include(OrderEntity).withWorkflow({
            // NOT `new OrderEntity()`: `state` has no initializer and
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
