import * as React from "react";
import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { TypeContext } from "@altea/altea/client/TypeContext";
import { OrderEntity } from "./Order.data";
import OrderFilter from "./OrderFilter";

// Orders domain client (Southwind's OrdersClient): registers Finder/Navigator settings for the Orders
// entities. Importing the entity module also registers its types on the client (token resolution).
export namespace OrdersClient {
    export function start(cb: ClientBuilder): void {
        cb.configure(OrderEntity)
            .withView(() => import("./Order"))
            .withQuerySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.customer),
                    token(a => a.employee),
                    token(a => a.orderDate),
                    token(a => a.state),
                    // Southwind's OrdersClient shows TotalPrice as a column. `totalPrice` is a registered
                    // expression (OrderLogic.server.ts) → a SERVER-only extension token. altea models expression
                    // members as @quoted methods, so the lambda navigation `a.totalPrice()` resolves it (the
                    // completer matches the "TotalPrice" key case-insensitively to the server token).
                    token(a => a.totalPrice()),
                ],
                // Southwind's OrdersClient `simpleFilterBuilder`: render the OrderFilter form (customer /
                // employee / order-date range) when the incoming filters are exactly representable by it —
                // OrderFilter.extract consumes each one and returns undefined if any is left over, in which
                // case the advanced filter builder is shown instead. A query with a simpleFilterBuilder
                // gets no default id+text filter (Finder.getDefaultFilter bails when one is present).
                simpleFilterBuilder: sfbc => {
                    const model = OrderFilter.extract(sfbc.initialFilterOptions);
                    if (!model)
                        return undefined;
                    return <OrderFilter ctx={TypeContext.root(model)} />;
                },
            }));
    }
}
