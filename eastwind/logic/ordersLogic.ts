import "@altea/altea/logic"; // installs Entity.save()/delete() (used by the OrderGraph)
import "@altea/altea/logic/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery / withExpressionTo
import { Query } from "@altea/altea/logic/query";
import { withQuoted } from "@altea/altea/entities/decorators";
import { table } from "@altea/altea/logic/table";
import { graph } from "@altea/altea/logic/graphBuilder";
import { SchemaBuilder } from "@altea/altea/logic/schema";
import { Lite } from "@altea/altea/entities/lite";
import { Temporal, toInt } from "@altea/altea/entities/basics";
import { retrieveFromListOfLite } from "@altea/altea/logic/Database";
import type { PrimaryKey } from "@altea/altea/entities/entity";
import {
    OrderEntity, OrderLineEntity, OrderState, OrderOperation,
    EmployeeEntity, ProductEntity,
} from "../entities/orders";
import type { CustomerEntity } from "../entities/customers";

// ---- Query navigation (declared in entities/orders.ts, implemented here) ----------
ProductEntity.prototype.lines = withQuoted(function (this: ProductEntity): Query<OrderLineEntity> {
    return table(OrderLineEntity).filter(ol => ol.product.id == this.id);
});

// ---- OrdersLogic.Start — port of Southwind's OrdersLogic.Start (schema includes + queries) --------
// Registers each entity's default WithQuery projection and the Product→OrderLines expression, then
// wires the OrderGraph. OrderLineEntity is an owned part entity, pulled in transitively via OrderEntity.details.
export namespace OrdersLogic {
    export function start(sb: SchemaBuilder): void {
        // altea's WithQuery is parameterless — the query is `table(T)`, columns are navigated as
        // rootless tokens; default display columns are a client concern. Person/Company (the concrete
        // CustomerEntity types) are included by CustomersLogic.
        sb.include(EmployeeEntity).withQuery();

        sb.include(ProductEntity)
            // Southwind exposes ProductEntity's order lines; altea registers ProductEntity.lines() as a
            // queryable expression token (`ProductEntity.lines` → the OrderLines whose product is this one).
            .withExpressionTo(p => p.lines())
            .withQuery();

        sb.include(OrderEntity).withQuery();
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

async function currentPrices(products: Lite<ProductEntity>[]): Promise<Map<PrimaryKey, number>> {
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
                    discount: 0,
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
                    discount: 0,
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
