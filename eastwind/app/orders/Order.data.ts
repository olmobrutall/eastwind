import { Entity, ModelEntity, MixinEntity } from "@altea/altea/data/entity";
import { Lite } from "@altea/altea/data/lite";
import {
    entity, part, backReference, rowOrder, quoted, mixin, implementedBy, unit, format, systemVersioned,
    legacyPropertyRoute, isReadOnly, bindParent,
} from "@altea/altea/data/decorators";
import { validate } from "@altea/altea/data/validators";
import { tryGetParentEntity } from "@altea/altea/data/parentEntity";
import { Temporal, type int, Decimal } from "@altea/altea/data/basics";
import { reflect, init } from "@altea/altea/data/reflection";
import type { ConstructSymbol, From, FromMany, ExecuteSymbol, DeleteSymbol } from "@altea/altea/data/operations";
import { AddressEmbedded, CustomerEntity, PersonEntity, CompanyEntity } from "../customers/Customer.data";
import { EmployeeEntity } from "../employees/Employee.data";
import { ProductEntity } from "../products/Product.data";
import { ShipperEntity } from "../shippers/Shipper.data";
import { msg } from "@altea/altea/data/utils/localization";
import type { SimpleTaskSymbol } from "@altea/altea-scheduler/data/Scheduler";
import type { ProcessAlgorithmSymbol, ProcessEntity } from "@altea/altea-processes/data/Processes";
import "@altea/altea/data/globals"; // Array.prototype.sum (in-memory) + its SQL-mappable aggregate (totalPrice)
import { Enum } from "@altea/altea/data/enum";

// Port of Southwind's Orders domain (Southwind/Orders/OrderEntity.cs), keeping Signum's Entity /
// Embedded name suffixes. OrderEntity.customer is @implementedBy(Person, Company) — the polymorphic
// CustomerEntity (see ./customers). Simplifications vs Signum: the OrderDetailEmbedded is modeled as
// an owned part entity (OrderLineEntity); the StateValidator is omitted.

export enum OrderState {
    /** Never stored — an order being created. Southwind marks it `[Ignore]`; the `markAsNotMapped` below
     *  is eastwind's spelling of the same thing. */
    New,
    Ordered,
    Shipped,
    Canceled,
}
Enum.markAsNotMapped(OrderState, OrderState.New);

// Southwind marks the Order table system-versioned (`Starter.OverrideAttributes`:
// `sb.Schema.Settings.TypeAttributes<OrderEntity>().Add(new SystemVersionedAttribute())`) — every row
// version is kept in a history table, which is what @altea/altea-time-machine reads. altea has no
// TypeAttributes side-channel, and eastwind owns this class, so the marker is the decorator itself.
@systemVersioned
@entity("Main", "Transactional")
// The whole-entity half of Southwind's `OrderEntity.IsPropertyReadonly`: once the order EXISTS it is
// mostly history — a placed one may still be re-addressed (`shipAddress` opts back out below), a shipped
// or cancelled one not even that. A rule about every member at once, which is what a CLASS-level
// `@isReadOnly` is for; the members that are read-only in every state carry their own above.
//
// It names the three STORED states rather than negating `New`, and that is not a style choice: altea does
// not initialize a field to its type default, so a fresh order`s `state` is UNDEFINED, not `New`. Written
// the other way round (`state === New ? undefined : true`) every new order came up entirely read-only.
// Signum is only safe from that because C# initializes the enum to 0.
//
// `undefined` for a new one DEFERS rather than answering, which is what lets a field say otherwise. A
// read-only line cascades, so `details` needs no mention: the whole EntityTable of order lines goes with it.
@isReadOnly<OrderEntity>(o =>
    o.state === OrderState.Ordered || o.state === OrderState.Shipped || o.state === OrderState.Canceled
        ? true : undefined)
export class OrderEntity extends Entity {
    // Signum's OrderEntity.Customer — polymorphic across the concrete customer types.
    @implementedBy(() => [PersonEntity, CompanyEntity])
    customer: CustomerEntity;
    employee: Lite<EmployeeEntity>;

    // Southwind lists this member, `shippedDate`, `cancelationDate`, `state` and `isLegacy` first in its
    // `IsPropertyReadonly` — they are the ENGINE's at every point in the life of an order, whatever state
    // it is in. That is a rule about ONE member each, so it goes on the member (Signum has no per-property
    // form to put it in, so it spells all five out in the method).
    @isReadOnly(true)
    orderDate: Temporal.PlainDate;
    requiredDate: Temporal.PlainDate;
    @isReadOnly(true)
    shippedDate: Temporal.PlainDate | null;
    @isReadOnly(true)
    cancelationDate: Temporal.PlainDate | null;

    shipVia: Lite<ShipperEntity> | null;
    shipName: string | null;

    // Southwind lets a PLACED order still be re-addressed: the only member the whole-entity rule above
    // does not freeze while the state is Ordered. A field-level `false` wins over it — which is the
    // escape hatch Signum's per-property hook cannot express, so it spells this out as a branch of the
    // entity method instead.
    @isReadOnly<OrderEntity>(o => o.state === OrderState.Ordered ? false : undefined)
    shipAddress: AddressEmbedded;

    @unit("Kg")
    freight: Decimal;

    // Signum's [PreserveOrder, BindParent] MList<OrderDetailEmbedded> Details → owned part rows. The
    // @bindParent is Southwind's, and it is what lets a LINE reach the order it belongs to: the row's own
    // `@backReference` is a Lite the SAVE cascade fills, so it is empty exactly when a rule needs it.
    @bindParent
    details: OrderLineEntity[];

    // `= false` is NOT restating a zero value: Signum's `public bool IsLegacy { get; set; }` IS initialized
    // — by C#, to false — and altea's implicit NotNull validator rejects an unset non-nullable field, so a
    // hand-created order (`/create/Order`, or the one a workflow's CreateNew strategy builds) could never be
    // saved without it. Only the LOADER sets it true, for the imported Northwind orders.
    @isReadOnly(true)
    isLegacy: boolean = false;

    @isReadOnly(true)
    state: OrderState;

    // Signum's [AutoExpressionField] TotalPrice => Details.Sum(od => od.SubTotalPrice).
    // @quoted so the SAME body both evaluates in-memory (Order.tsx's Total Price field, over the
    // loaded detail rows — the Decimal-aware Array.sum returns a Decimal) AND translates to a scalar
    // SUM subquery over the owned OrderLine rows — the latter is what makes the `totalPrice` extension
    // token (registered in OrderLogic.server.ts) a real, sortable/filterable Decimal column on the Order query.
    @legacyPropertyRoute
    @quoted
    totalPrice(): Decimal {
        return this.details.sum(d => d.subTotalPrice());
    }

}

export const OrderMessage = {
    // (Signum has no OrderMessage.TotalPrice: the expression's label is a MEMBER of OrderEntity, read via
    // OrderEntity.nicePropertyName — see OrderLogic's expression registration.)
    subTotalPrice: msg(),
    // Signum's typo is kept: the member name is the KEY the shipped translations already carry.
    discountShouldBeMultpleOf5: msg("Discount should be multiple of 5%"),
};

// Southwind's `OrderDetailMixin` (Orders/OrderEntity.cs), registered in its Starter as
// `MixinDeclarations.Register<OrderDetailEmbedded, OrderDetailMixin>()`. Kept under SOUTHWIND's name
// because a mixin's name is identity in a property route — `[OrderDetailMixin].discountCode` is what a
// property-auth rule and a translated instance store — where the entity it hangs off was free to be
// renamed (OrderDetailEmbedded -> OrderLineEntity) since altea's part rows carry their own table.
@reflect
export class OrderDetailMixin extends MixinEntity {
    discountCode: string | null = null;
}

// Owned child rows for OrderEntity.details (the per-row equivalent of Signum's
// OrderDetailEmbedded, whose embedded fields are flattened in here).
@part
// Southwind attaches OrderDetailMixin in its Starter; altea has no MixinDeclarations side-channel and
// eastwind owns this class, so the attachment is the decorator (as with @systemVersioned above).
@mixin(() => [OrderDetailMixin])
export class OrderLineEntity extends Entity {
    @backReference
    order: Lite<OrderEntity>;

    @rowOrder
    rowOrder: int;

    product: Lite<ProductEntity>;

    @unit("€")
    unitPrice: Decimal;

    quantity: int;

    /**
     * Southwind's `OrderEntity.ChildPropertyValidation`: on an order that is not LEGACY, a line's discount
     * must be a multiple of 5%. Signum has to write it as an override on the ORDER, because that is where
     * the rule can see `IsLegacy` — so it arrives as a method switching on `pi.Name == nameof(Discount)`.
     *
     * Here it goes on the field it is about, and reads the order through the parent back-pointer
     * (`@bindParent` on `OrderEntity.details`). So `ChildPropertyValidation` needs no counterpart: a rule
     * on the child that depends on the owner IS a rule on the child.
     *
     * An UNBOUND line (a graph nobody bound, or a line held by something other than an order) is left
     * alone rather than refused: `tryGetParentEntity` answers undefined and the rule stands down, which
     * is also what happens for the legacy imported orders.
     */
    @validate<OrderLineEntity>(l =>
        tryGetParentEntity(l, OrderEntity)?.isLegacy === false
            && !Decimal.mod(Decimal.mul(l.discount, 100), 5).isZero()
            ? OrderMessage.discountShouldBeMultpleOf5.niceToString()
            : null)
    @format("p")
    discount: Decimal;

    // Signum's [AutoExpressionField] SubTotalPrice => Quantity * UnitPrice * (1 - Discount).
    // Decimal arithmetic via the Decimal.* static methods: exact in-memory AND SQL-translatable
    // (the nominator lowers Decimal.mul/sub → the numeric operators — see server/decimalFunctions.ts).
    //
    // The expression is written OUT rather than quoted from the body, because the two must DIVERGE: SQL
    // propagates NULL through the product all by itself, where `Decimal.mul(undefined, …)` throws. A line
    // being typed in has neither quantity nor price yet — an EntityTable's "create" row is exactly that —
    // so the body has to answer for an incomplete line, and the SQL column must stay Signum's plain
    // product or every stored token over it would change shape. `null!` is what the caller already copes
    // with: Array.sum skips it, so `OrderEntity.totalPrice()` totals the lines that ARE complete.
    @legacyPropertyRoute
    @quoted(function (this: OrderLineEntity) {
        return Decimal.mul(Decimal.mul(this.quantity, this.unitPrice), Decimal.sub(1, this.discount));
    })
    subTotalPrice(): Decimal {
        if (this.quantity == null || this.unitPrice == null)
            return null!;

        return Decimal.mul(Decimal.mul(this.quantity, this.unitPrice), Decimal.sub(1, this.discount ?? 0));
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

// Southwind's `[AutoInit] static class OrderTask` / `OrderProcess` (Orders/OrderEntity.cs) — the scheduled
// tasks and the process algorithm this domain owns. They live HERE, beside the entity, because that is where
// Southwind keeps them: a task that walks orders is part of the Orders domain, not of the application shell.
export namespace OrderTask {
    /** Cancels every order older than a week through a PROCESS, so the run is resumable and reviewable. */
    export const CancelOldOrdersWithProcess: SimpleTaskSymbol = init();
    /** The same, set-based: one UPDATE, no process, no per-order log. */
    export const CancelOldOrders: SimpleTaskSymbol = init();
}

export namespace OrderProcess {
    /** Southwind's CancelOrderAlgorithm — a PackageExecuteAlgorithm over OrderOperation.Cancel. */
    export const CancelOrders: ProcessAlgorithmSymbol = init();
}

// Signum's `[AutoInit] static class OrderOperation`.
export namespace OrderOperation {
    export const Create: ConstructSymbol<OrderEntity> = init();
    export const CreateOrderFromCustomer: ConstructSymbol<OrderEntity, From<CustomerEntity>> = init();
    export const Clone: ConstructSymbol<OrderEntity, From<OrderEntity>> = init();
    export const CreateOrderFromProducts: ConstructSymbol<OrderEntity, FromMany<ProductEntity>> = init();
    export const Save: ExecuteSymbol<OrderEntity> = init();
    export const Ship: ExecuteSymbol<OrderEntity> = init();
    export const Cancel: ExecuteSymbol<OrderEntity> = init();
    export const Delete: DeleteSymbol<OrderEntity> = init();

    /** Southwind's `ConstructSymbol<ProcessEntity>.FromMany<OrderEntity> CancelWithProcess` — the
     *  contextual "cancel all of these", which builds a package and hands it to a CancelOrders process
     *  rather than cancelling inline. Its owner is the SOURCE type, so it is registered on OrderEntity. */
    export const CancelWithProcess: ConstructSymbol<ProcessEntity, FromMany<OrderEntity>> = init();
}

// Southwind's `OrderQuery.OrderLines` — one row per LINE, but the row's entity is the ORDER, so the
// search page navigates to the order a line belongs to. Signum flattens with `from od in o.Details`;
// here the source is the line table and the order is reached through the line's back reference, which
// is the same join. Named by its row model, whose clean name is the query key `OrderLines`.
@reflect
export class OrderLinesRowModel extends ModelEntity {
    /** Signum's `Entity = o` — the ORDER, not the line. */
    entity: Lite<OrderEntity>;
    id: int;
    product: Lite<ProductEntity>;
    quantity: int;
    @unit("€") unitPrice: Decimal;
    @format("p") discount: Decimal;
    @unit("€") subTotalPrice: Decimal;
}
