// PackageLogic — Signum.Processes' "turn a set of entities into work a process walks" half, and the two
// Southwind OrderTasks built on it.
//
// What this pins is the part that fails SILENTLY. A process algorithm that is declared but never registered
// still gets its symbol row and still looks fine on the panel; it simply never runs — the defect
// `DynamicViewOperation.Create` and `OfficeTemplateOperation.CreateOfficeTemplateFromOfficeModel` both had.
// So the checks here RUN things: the set-based task, the package-building task end to end (package → lines →
// process → every order actually cancelled), and a PackageOperation over an explicit operation symbol.
//
// It writes and then cleans up its own orders, and leaves every other row alone.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probePackageLogic.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { table } from "@altea/altea/server/table";
import { retrieve, deleteList } from "@altea/altea/server/Database";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { UserHolder } from "@altea/altea/server/userHolder";
import { UserWithClaims } from "@altea/altea/data/security";
import { Temporal, Decimal, toInt } from "@altea/altea/data/basics";
import { Clock } from "@altea/altea/data/utils/clock";
import type { Lite } from "@altea/altea/data/lite";
import type { Entity } from "@altea/altea/data/entity";
import { UserEntity } from "@altea/altea-auth/data/User";
import { SchedulerLogic } from "@altea/altea-scheduler/server/SchedulerLogic";
import { ScheduledTaskContext } from "@altea/altea-scheduler/server/ScheduleTaskRunner";
import { ScheduledTaskLogEntity } from "@altea/altea-scheduler/data/Scheduler";
import { ProcessLogic } from "@altea/altea-processes/server/ProcessLogic";
import { PackageLogic } from "@altea/altea-processes/server/PackageLogic";
import { ProcessEntity, ProcessState, ProcessExceptionLineEntity } from "@altea/altea-processes/data/Processes";
import { PackageEntity, PackageOperationEntity, PackageLineEntity, PackageOperationProcess } from "@altea/altea-processes/data/Package";
import { OrderEntity, OrderState, OrderTask, OrderProcess, OrderOperation } from "../orders/Order.data";
import { PersonEntity, type CustomerEntity } from "../customers/Customer.data";
import { EmployeeEntity } from "../employees/Employee.data";
import { AddressEmbedded } from "../customers/Customer.data";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

const created: Entity[] = [];

/**
 * Run a SimpleTask the way the scheduler's runner does — `SchedulerLogic.executeTask(symbol, ctx)`, which
 * dispatches through the handler `SimpleTaskLogic.start` registered. A task with no registered function
 * throws by name there, so this is also the check that both are wired.
 */
function runTask(taskSymbol: Parameters<typeof SchedulerLogic.executeTask>[0]): Promise<Lite<Entity> | null> {
    const log = ScheduledTaskLogEntity.create({
        task: taskSymbol,
        startTime: Clock.now,
        machineName: "probe",
        applicationName: "probe",
    });
    // Inside `Transaction.forceNew`, as ScheduleTaskRunner runs it — not decoration: the operation log's
    // BigString goes to a FILE, whose write is scheduled on `Transaction.preRealCommit`, so a task run
    // bare cannot log the operations it performs.
    return Transaction.forceNew(() => SchedulerLogic.executeTask(taskSymbol, new ScheduledTaskContext(log)));
}

/** An order dated `days` ago, in the state the tasks look for. */
async function makeOrder(days: number, customer: CustomerEntity, employee: Lite<EmployeeEntity>): Promise<OrderEntity> {
    const order = OrderEntity.create({
        customer,
        employee,
        orderDate: Temporal.Now.plainDateISO().subtract({ days }),
        requiredDate: Temporal.Now.plainDateISO().add({ days: 3 }),
        shipAddress: AddressEmbedded.create({ address: "probe", city: "probe", region: null, postalCode: null, country: "probe" }),
        freight: new Decimal(0),
        state: OrderState.Ordered,
        details: [],
    });
    await order.save();
    created.push(order);
    return order;
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    // ---- registration: the thing that fails silently ---------------------------------------------
    // A registered algorithm is what makes the symbol row mean anything. Both must resolve.
    let cancelOrders = false, packageOperation = false;
    try { ProcessLogic.getProcessAlgorithm(OrderProcess.CancelOrders); cancelOrders = true; } catch { /* below */ }
    try { ProcessLogic.getProcessAlgorithm(PackageOperationProcess.PackageOperation); packageOperation = true; } catch { /* below */ }
    check("OrderProcess.CancelOrders has an algorithm", cancelOrders);
    check("PackageOperationProcess.PackageOperation has an algorithm", packageOperation);

    const user = await ExecutionMode.global(() =>
        table(UserEntity).filter(u => u.userName == "System").singleOrNull()) as UserEntity | null;
    check("the System user exists (a process needs an owner)", user != null);
    if (user == null) { report(); return; }

    await UserHolder.withUser(new UserWithClaims(user.toLite(), { Role: user.role }), () => ExecutionMode.global(run));

    if (process.env["PROBE_KEEP"] == null)
        await cleanUp();
    report();
}

async function run(): Promise<void> {
    // CustomerEntity is ABSTRACT (Person / Company are the tables), so the probe picks a concrete one.
    const customer = await table(PersonEntity).firstOrNull() as PersonEntity | null;
    const employee = await table(EmployeeEntity).firstOrNull() as EmployeeEntity | null;
    if (customer == null || employee == null) {
        failures.push("the database has no customer / employee to build an order from — run `terminal csharp` first");
        return;
    }
    const employeeLite = employee.toLite();

    // ---- 1. OrderTask.CancelOldOrders — the SET-BASED half ---------------------------------------
    const stale = await makeOrder(10, customer, employeeLite);
    const fresh = await makeOrder(1, customer, employeeLite);

    await runTask(OrderTask.CancelOldOrders);

    const staleAfter = await retrieve(OrderEntity, stale.id!) as OrderEntity;
    const freshAfter = await retrieve(OrderEntity, fresh.id!) as OrderEntity;
    check("the set-based task cancels an order older than a week", staleAfter.state === OrderState.Canceled,
        String(staleAfter.state));
    check("...and stamps the cancelation date", staleAfter.cancelationDate != null, String(staleAfter.cancelationDate));
    check("...and leaves a recent order alone", freshAfter.state === OrderState.Ordered, String(freshAfter.state));

    // ---- 2. OrderTask.CancelOldOrdersWithProcess — package → process → lines ----------------------
    // Two more stale orders, freshly Ordered, so the process has something to cancel.
    const a = await makeOrder(9, customer, employeeLite);
    const b = await makeOrder(8, customer, employeeLite);

    const result = await runTask(OrderTask.CancelOldOrdersWithProcess);
    check("the task returns the process it created", result != null && result.entityType === ProcessEntity,
        String(result?.entityType?.name));
    if (result == null) return;

    const queued = await retrieve(ProcessEntity, result.id!) as ProcessEntity;
    check("it is a CancelOrders process", queued.algorithm.key === OrderProcess.CancelOrders.key, queued.algorithm.key!);
    // Southwind's `process.Execute(ProcessOperation.Execute)` QUEUES it — the runner picks it up. That is
    // the state the task leaves behind, and a terminal has no runner, so the probe runs it itself below.
    check("the task leaves the process Queued", queued.state === ProcessState.Queued, String(queued.state));

    const pack = await retrieve(PackageEntity, queued.data!.id!) as PackageEntity;
    const before = await PackageLogic.lines(pack).toArray() as PackageLineEntity[];
    check("the package has a line per stale order", before.length >= 2, String(before.length));
    check("a line's target is the order", before.every(l => l.target.entityType === OrderEntity));
    // `CreateLinesQuery` excludes the already-Canceled ones, so step 1's order is not packaged again.
    check("an already-canceled order is not packaged again",
        !before.some(l => String(l.target.id) === String(stale.id)), String(stale.id));

    // The algorithms walk `pendingLines`, so a wrong filter there is a process that finishes having done
    // nothing — which looks like success everywhere except the rows.
    const pending = await PackageLogic.pendingLines(pack).toArray() as PackageLineEntity[];
    check("every fresh line is PENDING", pending.length === before.length, `${pending.length} of ${before.length}`);


    const process = await ProcessLogic.executeTest(queued);
    check("the process runs to Finished", process.state === ProcessState.Finished,
        `${process.state} — ${process.exception?.toString() ?? "no exception"}`);

    const lines = await PackageLogic.lines(pack).toArray() as PackageLineEntity[];
    check("every line was finished", lines.every(l => l.finishTime != null),
        `${lines.filter(l => l.finishTime == null).length} of ${lines.length} unfinished`);

    const aAfter = await retrieve(OrderEntity, a.id!) as OrderEntity;
    const bAfter = await retrieve(OrderEntity, b.id!) as OrderEntity;
    check("the process really cancelled the orders",
        aAfter.state === OrderState.Canceled && bAfter.state === OrderState.Canceled,
        `${aAfter.state} / ${bAfter.state}`);
    // ---- 3. PackageOperationAlgorithm — the operation is DATA, not a compile-time choice ----------
    const c = await makeOrder(3, customer, employeeLite);
    const opProcess = await PackageLogic.createPackageOperation([c.toLite()], OrderOperation.Cancel);
    created.push(opProcess);
    const opPack = await retrieve(PackageOperationEntity, opProcess.data!.id!) as PackageOperationEntity;
    check("createPackageOperation records the operation on the package",
        opPack.operation.key === OrderOperation.Cancel.key, opPack.operation.key!);

    const ran = await ProcessLogic.executeTest(opProcess);
    check("the PackageOperation process runs to Finished", ran.state === ProcessState.Finished,
        `${ran.state} — ${ran.exception?.toString() ?? "no exception"}`);
    const cAfter = await retrieve(OrderEntity, c.id!) as OrderEntity;
    check("...and applied the named operation to the line", cAfter.state === OrderState.Canceled, String(cAfter.state));
}

/** Remove everything the probe made: lines, packages, processes, orders. */
async function cleanUp(): Promise<void> {
    await ExecutionMode.global(async () => {
        await Transaction.forceNew(async () => {
            const orderIds = created.filter(e => e instanceof OrderEntity).map(o => o.id!);
            if (orderIds.length === 0)
                return;

            // The processes this probe caused, found through the lines that point at its orders.
            const lines = await table(PackageLineEntity)
                .filter(l => orderIds.includes(l.target.id!)).toArray() as PackageLineEntity[];
            const packageIds = [...new Set(lines.map(l => String(l.package.id)))];

            const processes = await table(ProcessEntity)
                .filter(p => p.data != null).toArray() as ProcessEntity[];
            const mine = processes.filter(p => packageIds.includes(String(p.data!.id)));
            const mineIds = mine.map(p => p.id!);

            // A failed line leaves a ProcessExceptionLine pointing at the process, so those go FIRST or
            // the process delete fails on `fk_process_exception_line_process_id`.
            const exLines = await table(ProcessExceptionLineEntity)
                .filter(el => mineIds.includes(el.process.id!)).toArray() as ProcessExceptionLineEntity[];

            await deleteList(exLines);
            await deleteList(lines);
            await deleteList(mine);
            const packages = await table(PackageEntity).toArray() as PackageEntity[];
            await deleteList(packages.filter(p => packageIds.includes(String(p.id))));
            const orders = await table(OrderEntity).filter(o => orderIds.includes(o.id)).toArray() as OrderEntity[];
            await deleteList(orders);
        });
    });

    const left = await ExecutionMode.global(() => table(OrderEntity)
        .filter(o => o.shipName == null && o.shipAddress.city == "probe").count()) as number;
    check("the probe leaves no orders behind", left === 0, String(left));
}

function report(): void {
    console.log(`\n${pass} checks passed, ${failures.length} failed`);
    for (const f of failures)
        console.log("  FAIL " + f);
    void Connector.current().closeConnection().then(() => process.exit(failures.length === 0 ? 0 : 1));
}

void main();
