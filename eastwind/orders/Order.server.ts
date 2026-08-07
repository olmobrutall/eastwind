import "@altea/altea/server"; // installs Entity.save()/delete() (used by the OrderGraph)
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import { graph } from "@altea/altea/server/graphBuilder";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { Lite } from "@altea/altea/data/lite";
import { Temporal, toInt, toDecimal, type decimal } from "@altea/altea/data/basics";
import { retrieveFromListOfLite } from "@altea/altea/server/Database";
import type { PrimaryKey } from "@altea/altea/data/entity";
import { OrderEntity, OrderLineEntity, OrderState, OrderOperation, OrderMessage } from "./Order.data";
import { EmployeeEntity } from "../employees/Employee.data";
import { ProductEntity } from "../products/Product.data";
import type { CustomerEntity } from "../customers/Customer.data";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";

// ---- OrdersLogic.Start — port of Southwind's OrdersLogic.Start --------
// Registers OrderEntity's default WithQuery and wires the OrderGraph. OrderLineEntity is an owned
// part entity, pulled in transitively via OrderEntity.details. Employee/Product/Shipper/Customer are
// included by their own *Logic modules.
export namespace OrdersLogic {
    export function start(sb: SchemaBuilder): void {
        sb.include(OrderEntity).withQuery();

        QueryLogic.expressions.register(OrderEntity, o => o.totalPrice(), { niceName: () => OrderMessage.totalPrice.niceToString() });
        // Register the OrderGraph's operations (Save/Ship/Cancel/Delete/Create…) with OperationLogic
        // (Signum's `new OrderGraph().Register()`). Without this the /api/operation/* endpoints and
        // the entity pack's canExecute see no operations.
        OrderGraph.register();
    }
}

// ---- OrderGraph — port of Southwind's OrdersLogic.OrderGraph -----------------------
// `new Execute(sym){ … }.Register()` → `g.Execute(sym, { … })`; `GetState = o => o.State`
// → `g.GetState = o => o.state`. Adapted stand-ins: Clock.Today → today();
// EmployeeEntity.Current → currentEmployee(); `args.TryGetArgC/S<T>()` → `args[i] as T`;
// DB reads are async. CancelWithProcess is omitted (Processes not ported).

function today(): Temporal.PlainDate {
    return Temporal.Now.plainDateISO();
}

let _currentEmployee: Lite<EmployeeEntity> | null = null;
export function setCurrentEmployee(employee: Lite<EmployeeEntity> | null): void {
    _currentEmployee = employee;
}
function currentEmployee(): Lite<EmployeeEntity> {
    if (_currentEmployee == null)
        throw new Error("No current employee set (Signum's EmployeeEntity.Current).");
    return _currentEmployee;
}

async function currentPrices(products: Lite<ProductEntity>[]): Promise<Map<PrimaryKey, decimal>> {
    const entities = await retrieveFromListOfLite(products);
    return new Map(entities.map(p => [p.id, p.unitPrice]));
}

export const OrderGraph = graph(OrderEntity, OrderState, g => {
    g.GetState = o => o.state;

    g.Construct(OrderOperation.Create, {
        toStates: [OrderState.New],
        construct: async args => {
            const customerLite = args[0] as Lite<CustomerEntity> | undefined;
            const customer = customerLite != null ? (await retrieveFromListOfLite([customerLite]))[0] : null;
            return OrderEntity.create({
                customer: customer!,
                shipAddress: customer?.address.clone()!,
                state: OrderState.New,
                employee: currentEmployee(),
                requiredDate: today().add({ days: 3 }),
            });
        },
    });

    g.ConstructFrom(OrderOperation.CreateOrderFromCustomer, {
        toStates: [OrderState.New],
        construct: c => OrderEntity.create({
            state: OrderState.New,
            customer: c,
            employee: currentEmployee(),
            shipAddress: c.address.clone(),
            requiredDate: today().add({ days: 3 }),
        }),
    });

    g.ConstructFrom(OrderOperation.Clone, {
        canConstruct: o => o.state === OrderState.Shipped ? null : "Only shipped orders can be cloned.",
        toStates: [OrderState.Ordered],
        resultIsSaved: true,
        construct: async o => {
            const prices = await currentPrices(o.details.map(d => d.product));
            const order = OrderEntity.create({
                state: OrderState.Ordered,
                customer: o.customer,
                employee: currentEmployee(),
                shipAddress: o.shipAddress.clone(),
                requiredDate: today().add({ days: 3 }),
                orderDate: today(),
                details: o.details.map(d => OrderLineEntity.create({
                    product: d.product,
                    discount: toDecimal(0),
                    quantity: d.quantity,
                    unitPrice: prices.get(d.product.id)!,
                })),
            });
            return await order.save();
        },
    });

    g.ConstructFromMany(OrderOperation.CreateOrderFromProducts, {
        toStates: [OrderState.New],
        construct: async (prods, args) => {
            const prices = await currentPrices(prods);
            const customerLite = args[0] as Lite<CustomerEntity> | undefined;
            const customer = customerLite != null ? (await retrieveFromListOfLite([customerLite]))[0] : null;
            return OrderEntity.create({
                customer: customer!,
                shipAddress: customer?.address.clone()!,
                state: OrderState.New,
                employee: currentEmployee(),
                requiredDate: today().add({ days: 3 }),
                details: prods.map(p => OrderLineEntity.create({
                    product: p,
                    unitPrice: prices.get(p.id)!,
                    quantity: toInt(1),
                    discount: toDecimal(0),
                })),
            });
        },
    });

    g.Execute(OrderOperation.Save, {
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

    g.Execute(OrderOperation.Ship, {
        canExecute: o => o.details.length === 0 ? "Details is empty." : null,
        fromStates: [OrderState.Ordered],
        toStates: [OrderState.Shipped],
        canBeModified: true,
        execute: (o, args) => {
            o.shippedDate = (args[0] as Temporal.PlainDate | undefined) ?? today();
            o.state = OrderState.Shipped;
        },
    });

    g.Execute(OrderOperation.Cancel, {
        fromStates: [OrderState.Ordered, OrderState.Shipped],
        toStates: [OrderState.Canceled],
        execute: o => {
            o.cancelationDate = today();
            o.state = OrderState.Canceled;
        },
    });

    g.Delete(OrderOperation.Delete, {
        fromStates: [OrderState.Ordered],
        delete: o => o.delete(),
    });
});
