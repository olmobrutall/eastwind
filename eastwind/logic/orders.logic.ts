import { withQuoted, Query } from "@altea/altea/logic/query";
import { table } from "@altea/altea/logic/table";
import { Order, OrderLine, Product } from "../entities/orders";

// The lines() signatures are *declared* in entities/orders.ts (returning the
// shared IQuery<T>). Here we only provide the server-side *implementation* on
// the prototype; the concrete Query<T> returned implements IQuery<T>.

Order.prototype.lines = withQuoted(function (this: Order): Query<OrderLine> {
    return table(OrderLine).filter(ol => ol.order.id == this.id);
});

Product.prototype.lines = withQuoted(function (this: Product): Query<OrderLine> {
    return table(OrderLine).filter(ol => ol.product.id == this.id);
});
