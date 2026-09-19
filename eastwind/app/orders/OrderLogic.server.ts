import "@altea/altea/server"; // installs Entity.save()/delete() (used by the order operations)
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import { SchemaBuilder } from "@altea/altea/server/schema";
import { Lite } from "@altea/altea/data/lite";
import { Temporal, toInt, Decimal, type int } from "@altea/altea/data/basics";
import { retrieveFromListOfLite } from "@altea/altea/server/Database";
import type { PrimaryKey } from "@altea/altea/data/entity";
import { table } from "@altea/altea/server/table";
import { Clock } from "@altea/altea/data/utils/clock";
import type { Entity } from "@altea/altea/data/entity";
import { SimpleTaskLogic } from "@altea/altea-scheduler/server/SimpleTaskLogic";
import { ProcessLogic } from "@altea/altea-processes/server/ProcessLogic";
import { PackageLogic, PackageExecuteAlgorithm } from "@altea/altea-processes/server/PackageLogic";
import { PackageEntity } from "@altea/altea-processes/data/Package";
import { ProcessEntity, ProcessOperation } from "@altea/altea-processes/data/Processes";
import { Operations } from "@altea/altea/server/operationLogic";
import { inState } from "@altea/altea/server/operation";
import { ValidationMessage } from "@altea/altea/data/validators";
import {
    OrderEntity, OrderLineEntity, OrderState, OrderOperation, OrderMessage, OrderTask, OrderProcess, OrderLinesRowModel,
} from "./Order.data";
import { EmployeeEntity } from "../employees/Employee.data";
import { ProductEntity } from "../products/Product.data";
import { CustomerEntity } from "../customers/Customer.data";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import { AutoDynamicQueryCore } from "@altea/altea/server/dynamicQuery/dynamicQueryCore";
import { type FluentStateMachine } from "@altea/altea/server/fluentOperations";

// ---- OrdersLogic.Start — port of Southwind's OrdersLogic.Start --------
// Registers OrderEntity's default WithQuery and its operation state machine. OrderLineEntity is an owned
// part entity, pulled in transitively via OrderEntity.details. Employee/Product/Shipper/Customer are
// included by their own *Logic modules.
export namespace OrdersLogic {
    export function start(sb: SchemaBuilder): void {
        // Southwind's `QueryLogic.Queries.Register(OrderQuery.OrderLines, …)` — one row per LINE whose
        // ENTITY is the order. Signum flattens the order's Details; the source here is the line table and
        // the order comes through the line's back reference, which is the same join. A projection, so it
        // is an AutoDynamicQueryCore rather than `withQuery()` (which takes none), named by its row model.
        QueryLogic.queries.register(OrderLinesRowModel, () => new AutoDynamicQueryCore(() =>
            table(OrderLineEntity)
                .map(od => OrderLinesRowModel.create({
                    entity: od.order,
                    id: od.order.id as int,
                    product: od.product,
                    quantity: od.quantity,
                    unitPrice: od.unitPrice,
                    discount: od.discount,
                    subTotalPrice: od.subTotalPrice(),
                }))));

        sb.include(OrderEntity)
            .withStateMachine(o => o.state, registerOrderOperations)
            .withQuery();

        // Southwind labels TotalPrice as a MEMBER of OrderEntity (Signum's [AutoExpressionField] is a
        // property, so its translation lives under the type) and SubTotalPrice as an OrderMessage member.
        // Follow the translation file: reading the entity member keeps "Precio total" / "Gesamtpreis"
        // working without duplicating the string into a message container.
        QueryLogic.expressions.register(OrderEntity, o => o.totalPrice(), { niceName: () => OrderEntity.nicePropertyName(o => o.totalPrice()) });
        QueryLogic.expressions.register(OrderLineEntity, o => o.subTotalPrice(), { niceName: () => OrderMessage.subTotalPrice.niceToString() });
        // The domain's scheduled TASKS and its process ALGORITHM, registered where Southwind registers
        // them — in OrdersLogic, beside the graph (Orders/OrdersLogic.cs). Both registries are read when
        // their module starts (the symbol tables are seeded from the registered keys), and OrdersLogic.start
        // runs well before SchedulerLogic.start / ProcessLogic.start, so this is also the right ORDER.
        registerTasks();
        registerProcesses();

        // Southwind's `new Graph<ProcessEntity>.ConstructFromMany<OrderEntity>(OrderOperation
        // .CancelWithProcess)`, registered inside OrderGraph. It constructs a PROCESS, not an order, so it
        // cannot live on the order's own state machine — it hangs off the include of the CONSTRUCTED type
        // with the SOURCE type named first, which is altea's shape for every ConstructFromMany. The include
        // is idempotent and reaches the table altea-processes owns (the accommodation altea-workflow's
        // WorkflowEventTaskLogic makes for CaseEntity).
        sb.include(ProcessEntity).withConstructFromMany(OrderEntity, OrderOperation.CancelWithProcess, {
            construct: async orders => {
                const pack = await PackageLogic.createLines(PackageEntity.create({}), orders);
                return await ProcessLogic.create(OrderProcess.CancelOrders, pack.toLite());
            },
        });
    }

    /**
     * Southwind's two `SimpleTaskLogic.Register(OrderTask.…)` calls (Orders/OrdersLogic.cs), which are the
     * same job done two ways — the point of having both in a demo. Neither is scheduled by default.
     */
    function registerTasks(): void {
        // Southwind's `CancelOldOrdersWithProcess`: build a PACKAGE of the stale orders and hand it to a
        // process, so the run is resumable, cancellable, and leaves one reviewable line per order.
        SimpleTaskLogic.register(OrderTask.CancelOldOrdersWithProcess, async () => {
            const cutoff = today().subtract({ days: 7 });

            // Signum's `new PackageEntity().CreateLines(Database.Query<OrderEntity>().Where(…))` — the
            // query overload, so the ids never come into memory.
            const pack = await PackageLogic.createLinesFromQuery(PackageEntity.create({}),
                table(OrderEntity).filter(o => Temporal.PlainDate.compare(o.orderDate, cutoff) < 0
                    && o.state != OrderState.Canceled));

            const process = await ProcessLogic.create(OrderProcess.CancelOrders, pack.toLite());

            // Southwind runs it immediately rather than leaving it Created for the runner to pick up.
            const executed = await Operations.execute(process, ProcessOperation.Execute);

            return executed.toLite() as Lite<Entity>;
        });

        // Southwind's `CancelOldOrders`: the same outcome as ONE statement. No process, no per-order log,
        // and no operation — which is exactly the trade the pair exists to show.
        SimpleTaskLogic.register(OrderTask.CancelOldOrders, async () => {
            const cutoff = today().subtract({ days: 7 });
            const cancelationDate = today();

            await table(OrderEntity)
                .filter(o => Temporal.PlainDate.compare(o.orderDate, cutoff) < 0)
                .executeUpdate(() => ({ cancelationDate, state: OrderState.Canceled }));

            return null;
        });
    }

    /**
     * Southwind's `ProcessLogic.Register(OrderProcess.CancelOrders, new CancelOrderAlgorithm())`.
     *
     * `CancelOrderAlgorithm : PackageExecuteAlgorithm<OrderEntity>` overrides `Execute` only to call
     * `base.Execute` with a "// Override if necessary" comment beside it, so the subclass buys nothing
     * here — the base class IS the algorithm, and altea uses it directly.
     */
    function registerProcesses(): void {
        ProcessLogic.register(OrderProcess.CancelOrders,
            new PackageExecuteAlgorithm<OrderEntity>(OrderOperation.Cancel));
    }
}

// ---- The order state machine — port of Southwind's OrdersLogic.OrderGraph ----------
// `new Execute(sym){ … }.Register()` → `g.Execute(sym, { … })`; `GetState = o => o.State`
// → `g.GetState = o => o.state`. Adapted stand-ins: Clock.Today → today();
// `args.TryGetArgC/S<T>()` → `args[i] as T`; `EmployeeEntity.Current!` is kept verbatim (the non-null
// assertion is Southwind's: a user with no employee linked gets an order with an empty Employee line, which
// the implicit NotNull validator reports on save — better than a construct that refuses to open the form);
// DB reads are async.

function today(): Temporal.PlainDate {
    return Temporal.Now.plainDateISO();
}

async function currentPrices(products: Lite<ProductEntity>[]): Promise<Map<PrimaryKey, Decimal>> {
    const entities = await retrieveFromListOfLite(products);
    return new Map(entities.map(p => [p.id, p.unitPrice]));
}

function registerOrderOperations(sm: FluentStateMachine<OrderEntity, OrderState>): void {
    sm.withConstruct(OrderOperation.Create, {
        toStates: [OrderState.New],
        construct: async args => {
            const customerLite = args[0] as Lite<CustomerEntity> | undefined;
            const customer = customerLite != null ? (await retrieveFromListOfLite([customerLite]))[0] : null;
            return OrderEntity.create({
                customer: customer!,
                shipAddress: customer?.address.clone()!,
                state: OrderState.New,
                employee: EmployeeEntity.current()!,
                requiredDate: today().add({ days: 3 }),
            });
        },
    });

    sm.withConstructFrom(CustomerEntity, OrderOperation.CreateOrderFromCustomer, {
        toStates: [OrderState.New],
        construct: c => OrderEntity.create({
            state: OrderState.New,
            customer: c,
            employee: EmployeeEntity.current()!,
            shipAddress: c.address.clone(),
            requiredDate: today().add({ days: 3 }),
            // Southwind does not set this and does not have to: its OrderDate is a non-nullable DateOnly,
            // so C# hands the new order a value and the mandatory check passes. Here the field is
            // undefined until something writes it — and it is @isReadOnly(true), so the user CANNOT. A new
            // order was therefore unsaveable through the UI: validation demanded a field the form forbids
            // typing into, and the request was never sent. Save still overwrites this with today() when it
            // places the order (New → Ordered, below); this only stops the entity being born invalid.
            orderDate: today(),
        }),
    });

    sm.withConstructFrom(OrderEntity, OrderOperation.Clone, {
        // Southwind's `CanConstructExpression = o => o.State.InState(OrderState.Shipped)` — a ConstructFrom
        // has no `fromStates`, so the state guard is the generic `canConstruct`, worded by the same
        // message the graph's own transition check uses.
        canConstruct: o => inState(o.state, OrderState, OrderState.Shipped),
        toStates: [OrderState.Ordered],
        resultIsSaved: true,
        construct: async o => {
            const prices = await currentPrices(o.details.map(d => d.product));
            const order = OrderEntity.create({
                state: OrderState.Ordered,
                customer: o.customer,
                employee: EmployeeEntity.current()!,
                shipAddress: o.shipAddress.clone(),
                requiredDate: today().add({ days: 3 }),
                orderDate: today(),
                details: o.details.map(d => OrderLineEntity.create({
                    product: d.product,
                    discount: new Decimal(0),
                    quantity: d.quantity,
                    unitPrice: prices.get(d.product.id)!,
                })),
            });
            return await order.save();
        },
    });

    sm.withConstructFromMany(ProductEntity, OrderOperation.CreateOrderFromProducts, {
        toStates: [OrderState.New],
        construct: async (prods, args) => {
            const prices = await currentPrices(prods);
            const customerLite = args[0] as Lite<CustomerEntity> | undefined;
            const customer = customerLite != null ? (await retrieveFromListOfLite([customerLite]))[0] : null;
            return OrderEntity.create({
                customer: customer!,
                shipAddress: customer?.address.clone()!,
                state: OrderState.New,
                employee: EmployeeEntity.current()!,
                requiredDate: today().add({ days: 3 }),
                details: prods.map(p => OrderLineEntity.create({
                    product: p,
                    unitPrice: prices.get(p.id)!,
                    quantity: toInt(1),
                    discount: new Decimal(0),
                })),
            });
        },
    });

    sm.withExecute(OrderOperation.Save, {
        fromStates: [OrderState.New, OrderState.Ordered],
        toStates: [OrderState.Ordered],
        canBeNew: true,
        canBeModified: true,
        execute: o => {
            if (o.isNew)
                o.orderDate = today();
            o.state = OrderState.Ordered;
        },
    });

    sm.withExecute(OrderOperation.Ship, {
        // QUOTED (Southwind's `CanExecuteExpression`), not a plain `canExecute`: a Quoted IS the function,
        // so the in-memory guard is unchanged — and the expression is what lets Ship be a cell-operation
        // COLUMN (`[Operations].OrderOperation#Ship`), where the reason has to be computed per row in SQL.
        canExecuteExpression: o => o.details.length === 0
            ? ValidationMessage._0IsEmpty.niceToString(OrderEntity.nicePropertyName(a => a.details))
            : null,
        fromStates: [OrderState.Ordered],
        toStates: [OrderState.Shipped],
        canBeModified: true,
        execute: (o, args) => {
            o.shippedDate = (args[0] as Temporal.PlainDate | undefined) ?? today();
            o.state = OrderState.Shipped;
        },
    });

    sm.withExecute(OrderOperation.Cancel, {
        fromStates: [OrderState.Ordered, OrderState.Shipped],
        toStates: [OrderState.Canceled],
        execute: o => {
            o.cancelationDate = today();
            o.state = OrderState.Canceled;
        },
    });

    sm.withDelete(OrderOperation.Delete, {
        fromStates: [OrderState.Ordered],
        delete: o => o.delete(),
    });
}
