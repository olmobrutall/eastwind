import { init } from "@altea/altea/data/reflection";
import { table } from "@altea/altea/server/table";
import { Lite } from "@altea/altea/data/lite";
import { Entity } from "@altea/altea/data/entity";
import { Clock } from "@altea/altea/data/utils/clock";
import { SimpleTaskSymbol } from "@altea/altea-scheduler/data/Scheduler";
import { SimpleTaskLogic } from "@altea/altea-scheduler/server/SimpleTaskLogic.server";
import { OrderEntity } from "./orders/Order.data";

// Ported from Southwind's own scheduled tasks (Southwind.Server/Starter.cs registers a couple of
// SimpleTasks so the scheduler panel has something real to run). A SimpleTask is a NAMED FUNCTION: the
// symbol below is what a ScheduledTask row points at, and the function is what the runner calls.
//
// `register()` must run BEFORE SchedulerLogic.start — the SimpleTaskSymbol table is seeded from the
// registered keys, so a task registered later would have no row.

export namespace EastwindTask {

    /** Counts the orders that are still not shipped, and writes the count into the run's remarks. */
    export const CheckPendingOrders: SimpleTaskSymbol = init();

    /** Walks every unshipped order one by one, so a failure on one order is recorded as an exception LINE
     *  and the run continues (the point of ScheduledTaskContext.forEach). */
    export const ReviewPendingOrders: SimpleTaskSymbol = init();

    export function register(): void {
        SimpleTaskLogic.register(CheckPendingOrders, async ctx => {
            const pending = await table(OrderEntity).filter(o => o.shippedDate == null).toArray();

            ctx.writeLine(`${Clock.now.toString()} — ${pending.length} order(s) not shipped yet`);

            // The "product" of a run is whatever the panel should link to; the oldest pending order is the
            // one worth looking at.
            return (pending[0]?.toLite() ?? null) as Lite<Entity> | null;
        });

        SimpleTaskLogic.register(ReviewPendingOrders, async ctx => {
            const pending = await table(OrderEntity).filter(o => o.shippedDate == null).toArray();

            await ctx.forEachWriting(pending, o => `Order ${o.id}`, async order => {
                // Nothing to change — this exists to exercise the per-element transaction + cancellation
                // path that a real "process every pending order" task would use.
                void order;
            });

            return null;
        });
    }
}
