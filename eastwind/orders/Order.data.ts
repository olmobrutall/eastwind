import { Entity, ModelEntity } from "@altea/altea/data/entity";
import { Lite } from "@altea/altea/data/lite";
import { entity, backReference, rowOrder, quoted, implementedBy, unit, format } from "@altea/altea/data/decorators";
import { Temporal, type int, type decimal } from "@altea/altea/data/basics";
import { reflect, init } from "@altea/altea/data/reflection";
import type { ConstructSymbol, From, FromMany, ExecuteSymbol, DeleteSymbol } from "@altea/altea/data/operations";
import { AddressEmbedded, CustomerEntity, PersonEntity, CompanyEntity } from "../customers/Customer.data";
import { EmployeeEntity } from "../employees/Employee.data";
import { ProductEntity } from "../products/Product.data";
import { ShipperEntity } from "../shippers/Shipper.data";
import { msg } from "@altea/altea/data/utils/localization";
import "@altea/altea/data/globals"; // Array.prototype.sum (in-memory) + its SQL-mappable aggregate (totalPrice)

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

    @unit("Kg")
    freight: decimal;

    // Signum's [PreserveOrder] MList<OrderDetailEmbedded> Details → owned part rows.
    details: OrderLineEntity[];

    isLegacy: boolean;

    state: OrderState;

    // Signum's [AutoExpressionField] TotalPrice => Details.Sum(od => od.SubTotalPrice).
    // @quoted so the SAME body both evaluates in-memory (Order.tsx's Total Price field, over the
    // loaded detail rows) AND translates to a scalar subquery over the owned OrderLine rows — the
    // latter is what makes the `totalPrice` extension token (registered in Order.server.ts) a real,
    // sortable/filterable column on the Order query. `subTotalPrice` is itself @quoted, so it inlines.
    @quoted
    totalPrice(): number {
        return this.details.sum(d => d.subTotalPrice());
    }
}

export const OrderMessage = {
    totalPrice: msg()
};

// Owned child rows for OrderEntity.details (the per-row equivalent of Signum's
// OrderDetailEmbedded, whose embedded fields are flattened in here).
@entity("Part")
export class OrderLineEntity extends Entity {
    @backReference
    order: Lite<OrderEntity>;

    @rowOrder
    rowOrder: int;

    product: Lite<ProductEntity>;

    @unit("€")
    unitPrice: decimal;

    quantity: int;

    @format("p")
    discount: decimal;

    // Signum's [AutoExpressionField] SubTotalPrice => Quantity * UnitPrice * (1 - Discount).
    @quoted
    subTotalPrice(): number {
        return this.quantity * this.unitPrice * (1 - this.discount);
    }
}

// Southwind's OrderFilterModel (OrderEntity.cs): the shape backing the Orders SIMPLE FILTER BUILDER — a
// ModelEntity (reflected, never persisted) whose fields are the search form's inputs. Not a query row
// model; it only lives client-side inside OrderFilter (TypeContext.root(model)). Mirrors CustomerRowModel.
@reflect
export class OrderFilterModel extends ModelEntity {
    // Polymorphic like OrderEntity.customer — the filter picks a lite of a Person or a Company.
    @implementedBy(() => [PersonEntity, CompanyEntity])
    customer: Lite<CustomerEntity> | null = null;
    employee: Lite<EmployeeEntity> | null = null;
    minOrderDate: Temporal.PlainDate | null = null;
    maxOrderDate: Temporal.PlainDate | null = null;
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
