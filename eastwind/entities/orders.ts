import { reflect } from "@altea/altea/entities/reflection";
import { Entity, EmbeddedEntity } from "@altea/altea/entities/entity";
import { Lite } from "@altea/altea/entities/lite";
import { partEntity, backReference, rowOrder, column, quoted } from "@altea/altea/entities/decorators";
import { Temporal, type int } from "@altea/altea/entities/basics";
import type { IQuery } from "@altea/altea/entities/iquery";
import { init } from "@altea/altea/entities/reflection";
import type { ConstructSymbol, From, FromMany, ExecuteSymbol, DeleteSymbol } from "@altea/altea/entities/operations";

// Port of Southwind's Orders domain (Southwind/Orders/OrderEntity.cs), in eastwind's
// non-suffixed naming (Order, not OrderEntity). @reflect auto-injects @field on every
// property. Simplifications vs Signum: Customer is concrete (not @implementedBy
// Company/Person); ShipVia/ShipName/Freight/IsLegacy, the StateValidator and the mixin
// are omitted; prices are plain numbers; Processes (CancelWithProcess) is not ported.

@reflect
export class Address extends EmbeddedEntity {
    address: string;
    city: string;
    region: string | null;

    // Signum's AddressEmbedded.Clone() — a fresh copy (an order snapshots the customer's
    // address at creation, not a live reference).
    clone(): Address {
        return Address.create({ address: this.address, city: this.city, region: this.region });
    }
}

@reflect
export class Customer extends Entity {
    name: string;
    address: Address;
    @quoted toString(): string { return this.name; }
}

@reflect
export class Employee extends Entity {
    name: string;
    @quoted toString(): string { return this.name; }
}

@reflect
export class Product extends Entity {
    name: string;
    description: string;
    discontinued: boolean;
    unitPrice: number;
}
// Cross-entity navigation declared here, implemented in logic/ (where table(T) lives).
export interface Product {
    lines(): IQuery<OrderLine>;
}

export enum OrderState {
    New,
    Ordered,
    Shipped,
    Canceled,
}

@reflect
export class Order extends Entity {
    customer: Customer;
    employee: Lite<Employee>;

    orderDate: Temporal.PlainDate;
    requiredDate: Temporal.PlainDate;
    @column({ nullable: true })
    shippedDate: Temporal.PlainDate | null;
    @column({ nullable: true })
    cancelationDate: Temporal.PlainDate | null;

    shipAddress: Address;

    // Signum's [PreserveOrder] MList<OrderDetailEmbedded> Details → owned part rows.
    details: OrderLine[];

    state: OrderState;

    // Signum's [AutoExpressionField] TotalPrice => Details.Sum(od => od.SubTotalPrice).
    // Plain (not @quoted) here — a Sum over the owned collection isn't part of the query
    // model yet — so it's an in-memory helper only.
    totalPrice(): number {
        return this.details.reduce((sum, d) => sum + d.subTotalPrice(), 0);
    }
}

// Owned child rows for Order.details (the per-row equivalent of Signum's
// OrderDetailEmbedded, whose embedded fields are flattened in here).
@partEntity
export class OrderLine extends Entity {
    @backReference
    order: Lite<Order>;

    @rowOrder
    rowOrder: int;

    product: Lite<Product>;
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
    export const Create: ConstructSymbol<Order> = init();
    export const CreateOrderFromCustomer: ConstructSymbol<Order, From<Customer>> = init();
    export const Clone: ConstructSymbol<Order, From<Order>> = init();
    export const CreateOrderFromProducts: ConstructSymbol<Order, FromMany<Product>> = init();
    export const Save: ExecuteSymbol<Order> = init();
    export const Ship: ExecuteSymbol<Order> = init();
    export const Cancel: ExecuteSymbol<Order> = init();
    export const Delete: DeleteSymbol<Order> = init();
}
