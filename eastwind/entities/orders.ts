import { reflect } from "@altea/altea/entities/reflection";
import { include } from "@altea/altea/entities/decorators";
import { Entity } from "@altea/altea/entities/entity";
import { Lite } from "@altea/altea/entities/lite";
import { IQuery } from "@altea/altea/entities/iquery";

// @reflect auto-injects @field on every (non-ignored) property — no need to
// annotate each one. Single-entity navigations are plain Lite<T> references and
// live here in entities/ (shared). Collection navigations are *declared* here
// (returning the shared IQuery<T>) via interface merging, but *implemented* in
// logic/ (where Query<T>/table(T) live).

@reflect
export class Order extends Entity {
    amount: number;
    creationDate: Date;
}
export interface Order {
    lines(): IQuery<OrderLine>;
}

@reflect
export class OrderLine extends Entity {
    @include(() => Order)
    order: Lite<Order>;
    @include(() => Product)
    product: Lite<Product>;
    quantity: number;
    unitPrice: number;
}

@reflect
export class Product extends Entity {
    name: string;
    description: string;
    discontinued: boolean;
    unitPrice: number;
}
export interface Product {
    lines(): IQuery<OrderLine>;
}
