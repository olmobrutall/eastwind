import { Entity, ModelEntity, MixinEntity } from "@altea/altea/data/entity";
import { Lite } from "@altea/altea/data/lite";
import {
    entity, part, backReference, rowOrder, quoted, mixin, implementedBy, unit, format, systemVersioned,
    legacyPropertyRoute, isReadOnly, bindParent,
} from "@altea/altea/data/decorators";
import { validate, stringLengthValidator, noRepeatValidator } from "@altea/altea/data/validators";
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

// The Orders domain. OrderEntity.customer is @implementedBy(Person, Company) — the polymorphic
// CustomerEntity (see ./customers). The order LINES are owned part rows (OrderLineEntity) rather than
// embedded values.

export enum OrderState {
    /** Never stored — an order being created; `markAsNotMapped` below is what keeps it out of the
     *  enum table. */
    New,
    Ordered,
    Shipped,
    Canceled,
}
Enum.markAsNotMapped(OrderState, OrderState.New);

// The Order table is SYSTEM-VERSIONED: every row version is kept in a history table, which is what
// @altea/altea-time-machine reads.

@systemVersioned
@entity("Main", "Transactional")
// The whole-entity read-only rule: once the order EXISTS it is mostly history — a placed one may still be
// re-addressed (`shipAddress` opts back out below), a shipped or cancelled one not even that. A rule about
// every member at once, which is what a CLASS-level `@isReadOnly` is for; the members that are read-only
// in every state carry their own above.
//
// It names the three STORED states rather than negating `New`, and that is not a style choice: altea does
// not initialize a field to its type default, so a fresh order's `state` is UNDEFINED, not `New`. Written
// the other way round (`state === New ? undefined : true`) every new order came up entirely read-only.
//
// `undefined` for a new one DEFERS rather than answering, which is what lets a field say otherwise. A
// read-only line cascades, so `details` needs no mention: the whole EntityTable of order lines goes with it.
@isReadOnly<OrderEntity>(o =>
    o.state === OrderState.Ordered || o.state === OrderState.Shipped || o.state === OrderState.Canceled
        ? true : undefined)
export class OrderEntity extends Entity {
    // Polymorphic across the concrete customer types.
    @implementedBy(() => [PersonEntity, CompanyEntity])
    customer: CustomerEntity;
    employee: Lite<EmployeeEntity>;

    // This member, `shippedDate`, `cancelationDate`, `state` and `isLegacy` are the ENGINE's at every
    // point in the life of an order, whatever state it is in. That is a rule about ONE member each, so it
    // goes on the member rather than in the class-level rule.
    @isReadOnly(true)
    orderDate: Temporal.PlainDate;
    requiredDate: Temporal.PlainDate;
    @isReadOnly(true)
    shippedDate: Temporal.PlainDate | null;
    @isReadOnly(true)
    cancelationDate: Temporal.PlainDate | null;

    shipVia: Lite<ShipperEntity> | null;
    @stringLengthValidator({ min: 3, max: 40 })
    shipName: string | null;

    // A PLACED order may still be re-addressed: the only member the whole-entity rule above does not
    // freeze while the state is Ordered. A field-level `false` wins over the class-level rule.
    @isReadOnly<OrderEntity>(o => o.state === OrderState.Ordered ? false : undefined)
    shipAddress: AddressEmbedded;

    @unit("Kg")
    freight: Decimal;

    // Owned part rows, order preserved. @bindParent is what lets a LINE reach the order it belongs to:
    // the row's own `@backReference` is a Lite the SAVE cascade fills, so it is empty exactly when a rule
    // needs it.
    @bindParent
    @noRepeatValidator<OrderLineEntity>(a => a.product)
    details: OrderLineEntity[];

    // `= false` is load-bearing: altea's implicit NotNull validator rejects an unset non-nullable field, so
    // a hand-created order (`/create/Order`, or the one a workflow's CreateNew strategy builds) could never
    // be saved without it. Only the LOADER sets it true, for the imported Northwind orders.
    @isReadOnly(true)
    isLegacy: boolean = false;

    @isReadOnly(true)
    state: OrderState;

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
    // `totalPrice` is a `@quoted` METHOD, not a property. A property is a PropertyRoute and gets a
    // <Member> entry to hold its translation; a method does not — so `OrderEntity.nicePropertyName(o =>
    // o.totalPrice())` had nothing to read and humanised to "Total price" in EVERY culture, which is what
    // the order grid showed among otherwise German headers. Declaring it here is what brings the shipped
    // translations back. Same fix as RestLogMessage.Duration — see F1 in port/TranslationGaps.md.
    totalPrice: msg("Total price"),
    subTotalPrice: msg(),
    // The typo is deliberate: the member name is the KEY the shipped translations already carry.
    discountShouldBeMultpleOf5: msg("Discount should be multiple of 5%"),
};

// A mixin on the order LINE. Its name is identity in a property route —
// `[OrderDetailMixin].discountCode` is what a property-auth rule and a translated instance store — so it
// keeps the name it was first stored under, where the entity it hangs off was free to be renamed
// (OrderDetailEmbedded -> OrderLineEntity) since altea's part rows carry their own table.
@reflect
export class OrderDetailMixin extends MixinEntity {
    discountCode: string | null = null;
}

// Owned child rows for OrderEntity.details.
@part
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
     * On an order that is not LEGACY, a line's discount must be a multiple of 5%.
     *
     * It goes on the field it is about, and reads the order through the parent back-pointer
     * (`@bindParent` on `OrderEntity.details`): a rule on the child that depends on the owner IS a rule on
     * the child.
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

    // SubTotalPrice = Quantity * UnitPrice * (1 - Discount).
    // Decimal arithmetic via the Decimal.* static methods: exact in-memory AND SQL-translatable
    // (the nominator lowers Decimal.mul/sub → the numeric operators — see server/decimalFunctions.ts).
    //
    // The expression is written OUT rather than quoted from the body, because the two must DIVERGE: SQL
    // propagates NULL through the product all by itself, where `Decimal.mul(undefined, …)` throws. A line
    // being typed in has neither quantity nor price yet — an EntityTable's "create" row is exactly that —
    // so the body has to answer for an incomplete line, and the SQL column must stay the plain
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

// The shape backing the Orders SIMPLE FILTER BUILDER — a
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

// The scheduled tasks and the process algorithm this domain owns. They live HERE, beside the entity:
// a task that walks orders is part of the Orders domain, not of the application shell.

export namespace OrderTask {
    /** Cancels every order older than a week through a PROCESS, so the run is resumable and reviewable. */
    export const CancelOldOrdersWithProcess: SimpleTaskSymbol = init();
    /** The same, set-based: one UPDATE, no process, no per-order log. */
    export const CancelOldOrders: SimpleTaskSymbol = init();
}

export namespace OrderProcess {
    /** A PackageExecuteAlgorithm over OrderOperation.Cancel. */
    export const CancelOrders: ProcessAlgorithmSymbol = init();
}

export namespace OrderOperation {
    export const Create: ConstructSymbol<OrderEntity> = init();
    export const CreateOrderFromCustomer: ConstructSymbol<OrderEntity, From<CustomerEntity>> = init();
    export const Clone: ConstructSymbol<OrderEntity, From<OrderEntity>> = init();
    export const CreateOrderFromProducts: ConstructSymbol<OrderEntity, FromMany<ProductEntity>> = init();
    export const Save: ExecuteSymbol<OrderEntity> = init();
    export const Ship: ExecuteSymbol<OrderEntity> = init();
    export const Cancel: ExecuteSymbol<OrderEntity> = init();
    export const Delete: DeleteSymbol<OrderEntity> = init();

    /** The
     *  contextual "cancel all of these", which builds a package and hands it to a CancelOrders process
     *  rather than cancelling inline. Its owner is the SOURCE type, so it is registered on OrderEntity. */
    export const CancelWithProcess: ConstructSymbol<ProcessEntity, FromMany<OrderEntity>> = init();
}

// One row per LINE, but the row's entity is the ORDER, so the
// search page navigates to the order a line belongs to. The source is the line table and the order is
// reached through the line's back reference. Named by its row model, whose clean name is the query key
// `OrderLines`.
@reflect
export class OrderLinesRowModel extends ModelEntity {
    /** The ORDER, not the line. */
    entity: Lite<OrderEntity>;
    id: int;
    product: Lite<ProductEntity>;
    quantity: int;
    @unit("€") unitPrice: Decimal;
    @format("p") discount: Decimal;
    @unit("€") subTotalPrice: Decimal;
}
