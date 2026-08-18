import { init } from "@altea/altea/data/reflection";
import { table } from "@altea/altea/server/table";
import { ProcessAlgorithmSymbol } from "@altea/altea-processes/data/Processes";
import { ProcessLogic } from "@altea/altea-processes/server/ProcessLogic.server";
import { OrderEntity } from "./orders/Order.data";

// Ported from Southwind's own process algorithms (Southwind.Server registers a couple so the process panel
// has something real to run). A PROCESS ALGORITHM is a long job the runner drives: it reports progress, may
// be suspended mid-flight, and records a failure per element rather than losing the run.
//
// `register()` must run BEFORE ProcessLogic.start — the ProcessAlgorithmSymbol table is seeded from the
// registered keys.

export namespace EastwindProcess {

    /** Walks every unshipped order, reporting progress. Deliberately does no writing: it exists to exercise
     *  the runner (progress, suspend, per-element exception lines) against real rows. */
    export const ReviewPendingOrders: ProcessAlgorithmSymbol = init();

    export function register(): void {
        ProcessLogic.registerAction(ReviewPendingOrders, async ctx => {
            const pending = await table(OrderEntity).filter(o => o.shippedDate == null).toArray();

            await ctx.writeMessage(`Reviewing ${pending.length} pending order(s)`);

            await ctx.forEach(pending, o => `Order ${o.id}`, async order => {
                // A real algorithm would do its work here; the point is that each element runs in its own
                // transaction, progress ticks after each one, and a cancellation is honoured between them.
                void order;
            }, order => order.toLite());

            await ctx.writeMessage(`Reviewed ${pending.length} order(s)`);
        });
    }
}
