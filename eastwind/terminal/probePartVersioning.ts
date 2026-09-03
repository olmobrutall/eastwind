// A `@part` row of a @systemVersioned owner is versioned TOO — Signum's SchemaBuilder.cs:1019-1021, where
// an MList table inherits its owner's [SystemVersioned]. `OrderEntity` is versioned (as in Southwind), so
// its `details` rows are what actually change on an order, and without the cascade the Time Machine could
// only ever show the header moving.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probePartVersioning.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { Schema } from "@altea/altea/server/schema/schema";
import { SystemTime, SystemTimeJoinModeKeys } from "@altea/altea/server/systemTime";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { OrderEntity, OrderLineEntity } from "../orders/Order.data";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    // 1. The SCHEMA: the part table is versioned, and with its OWN history table — never the owner's
    // (the whole reason the inherited config is a fresh default rather than a copy).
    const orderTable = Schema.current.table(OrderEntity);
    const lineTable = Schema.current.table(OrderLineEntity);
    check("the owner is versioned", orderTable.systemVersioned != null);
    check("the part row is versioned too", lineTable.systemVersioned != null);
    check("the part has its OWN history table",
        lineTable.systemVersioned != null
        && lineTable.systemVersioned.historyTableName.toString() !== orderTable.systemVersioned!.historyTableName.toString(),
        lineTable.systemVersioned?.historyTableName.toString());

    // 2. The CAPABILITY: change one line's quantity and read the order back as it was before.
    const order = await table(OrderEntity).filter(o => o.details.length > 0).first() as OrderEntity;
    const line = order.details[0]!;
    const before = line.quantity;
    const restore = before;
    console.log(`  (order ${order.id}, line ${line.id}, quantity ${before})`);

    // A bound strictly inside the line's CURRENT period, so "as of then" is unambiguous.
    const asOf = await SystemTime.override(new SystemTime.All(SystemTimeJoinModeKeys.FirstCompatible), async () =>
        await table(OrderLineEntity).filter(l => l.id == line.id).map(l => l.systemPeriod().min).first());
    check("the line has a period", asOf != null, String(asOf));

    try {
        line.quantity = (before + 1) as typeof before;
        await ExecutionMode.global(async () => { await order.save(); });

        const now = await table(OrderLineEntity).filter(l => l.id == line.id).map(l => l.quantity).first();
        check("the change is live", now === before + 1, `${now} vs ${before + 1}`);

        // The payoff: the PREVIOUS version of the line, which only exists if the part table is versioned.
        const then = await SystemTime.override(new SystemTime.AsOf(asOf!), async () =>
            await table(OrderLineEntity).filter(l => l.id == line.id).map(l => l.quantity).first());
        check("as-of reads the OLD quantity", then === before, `${then} vs ${before}`);

        // And a history row now exists for it (Signum's SystemTime.All = main + history).
        const versions = await SystemTime.override(new SystemTime.All(SystemTimeJoinModeKeys.AllCompatible), async () =>
            await table(OrderLineEntity).filter(l => l.id == line.id).toArray());
        check("the line now has two versions", versions.length === 2, String(versions.length));
    } finally {
        line.quantity = restore;
        await ExecutionMode.global(async () => { await order.save(); });
        const back = await table(OrderLineEntity).filter(l => l.id == line.id).map(l => l.quantity).first();
        console.log(`  (restored quantity to ${back})`);
    }

    console.log(`\n[part-versioning] ${pass} checks passed`);
    for (const f of failures)
        console.log("  FAILED " + f);

    await Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
