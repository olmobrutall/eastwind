import { Entity } from "@altea/altea/entities/entity";
import { Lite } from "@altea/altea/entities/lite";
import { entity, backReference, rowOrder, quoted, implementedBy } from "@altea/altea/entities/decorators";
import { Temporal, type int } from "@altea/altea/entities/basics";
import { reflect, init } from "@altea/altea/entities/reflection";
import type { ConstructSymbol, From, FromMany, ExecuteSymbol, DeleteSymbol } from "@altea/altea/entities/operations";
import { AddressEmbedded, CustomerEntity, PersonEntity, CompanyEntity } from "./customers";
import { EmployeeEntity } from "./employees";
import { ProductEntity } from "./products";
import { ShipperEntity } from "./shippers";

// Port of Southwind's Orders domain (Southwind/Orders/OrderEntity.cs), keeping Signum's Entity /
// Embedded name suffixes. OrderEntity.customer is @implementedBy(Person, Company) — the polymorphic
// CustomerEntity (see ./customers). Simplifications vs Signum: the OrderDetailEmbedded is modeled as
// an owned part entity (OrderLineEntity); the StateValidator, IsPropertyReadonly, OrderDetailMixin and
// Processes (CancelWithProcess) are omitted (extension-free).

export enum OrderState {
    New,
    Ordered,
    Shipped,
    Canceled,
}

@entity("Main", "Transactional")
export class OrderEntity extends Entity {
    // Signum's OrderEntity.Customer — polymorphic across the concrete customer types.
    @implementedBy(() => [PersonEntity, CompanyEntity])
    customer: CustomerEntity;
    employee: Lite<EmployeeEntity>;

    orderDate: Temporal.PlainDate;
    requiredDate: Temporal.PlainDate;
    shippedDate: Temporal.PlainDate | null;
    cancelationDate: Temporal.PlainDate | null;

    shipVia: Lite<ShipperEntity> | null;
    shipName: string | null;

    shipAddress: AddressEmbedded;

    freight: number;

    // Signum's [PreserveOrder] MList<OrderDetailEmbedded> Details → owned part rows.
    details: OrderLineEntity[];

    isLegacy: boolean;

    state: OrderState;

    // Signum's [AutoExpressionField] TotalPrice => Details.Sum(od => od.SubTotalPrice).
    // Plain (not @quoted) here — a Sum over the owned collection isn't part of the query
    // model yet — so it's an in-memory helper only.
    totalPrice(): number {
        return this.details.reduce((sum, d) => sum + d.subTotalPrice(), 0);
    }
}

// Owned child rows for OrderEntity.details (the per-row equivalent of Signum's
// OrderDetailEmbedded, whose embedded fields are flattened in here).
@entity("Part")
export class OrderLineEntity extends Entity {
    @backReference
    order: Lite<OrderEntity>;

    @rowOrder
    rowOrder: int;

    product: Lite<ProductEntity>;
    unitPrice: number;
    quantity: int;
    discount: number;

    // Signum's [AutoExpressionField] SubTotalPrice => Quantity * UnitPrice * (1 - Discount).
    @quoted
    subTotalPrice(): number {
        return this.quantity * this.unitPrice * (1 - this.discount);
    }
}

// Signum's `[AutoInit] static class OrderOperation`. CancelWithProcess is omitted (Processes).
export namespace OrderOperation {
    export const Create: ConstructSymbol<OrderEntity> = init();
    export const CreateOrderFromCustomer: ConstructSymbol<OrderEntity, From<CustomerEntity>> = init();
    export const Clone: ConstructSymbol<OrderEntity, From<OrderEntity>> = init();
    export const CreateOrderFromProducts: ConstructSymbol<OrderEntity, FromMany<ProductEntity>> = init();
    export const Save: ExecuteSymbol<OrderEntity> = init();
    export const Ship: ExecuteSymbol<OrderEntity> = init();
    export const Cancel: ExecuteSymbol<OrderEntity> = init();
    export const Delete: DeleteSymbol<OrderEntity> = init();
}
