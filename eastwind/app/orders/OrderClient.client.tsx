import * as React from "react";
import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { Finder } from "@altea/altea/client/Finder";
import { TypeContext } from "@altea/altea/client/TypeContext";
import { Clock } from "@altea/altea/data/utils/clock";
import { Temporal } from "@altea/altea/data/basics";
import AutoLineModal from "@altea/altea/client/AutoLineModal";
import { OrderEntity, OrderOperation } from "./Order.data";
import { CustomerEntity, CustomerRowModel } from "../customers/Customer.data";
import OrderFilter from "./OrderFilter";

// Orders domain client: registers Finder/Navigator settings for the Orders
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
                    // TotalPrice is shown as a column. `totalPrice` is a registered
                    // expression (OrderLogic.server.ts) → a SERVER-only extension token. altea models expression
                    // members as @quoted methods, so the lambda navigation `a.totalPrice()` resolves it (the
                    // completer matches the "TotalPrice" key case-insensitively to the server token).
                    token(a => a.totalPrice()),
                ],
                // The `simpleFilterBuilder`: render the OrderFilter form (customer /
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
            }))
            // Both constructors ask which customer first: the server reads the lite off `args[0]` and fills
            // `customer` + `shipAddress` from it, so an order built without one is invalid.
            // CustomerRowModel is the Person + Company union query; `find` returns the row's `entity`.
            .withConstructorOperation(OrderOperation.Create, {
                onConstruct: coc => Finder.find<CustomerEntity>({ queryName: CustomerRowModel })
                    .then(c => c && coc.defaultConstruct(c)),
            })
            // Same picker, from the Product search control's contextual menu.
            .withContextualOperation(OrderOperation.CreateOrderFromProducts, {
                onClick: coc => Finder.find<CustomerEntity>({ queryName: CustomerRowModel })
                    .then(c => c && coc.defaultClick(c)),
            })
            // Ship asks for the date, which the server takes as `args[0]` (it defaults to today otherwise).
            // From many rows there is no one order to seed it from, hence the two entry points.
            .withEntityOperation(OrderOperation.Ship, {
                color: "info",
                icon: "truck",
                commonOnClick: oc => oc.getEntity()
                    .then(o => selectShippedDate(o.requiredDate))
                    .then(date => date && oc.defaultClick(date)),
                contextualFromMany: {
                    onClick: coc => selectShippedDate(Clock.today)
                        .then(date => date && coc.defaultClick(date)),
                },
            });
    }

    function selectShippedDate(initialValue: Temporal.PlainDate): Promise<Temporal.PlainDate | undefined> {
        return AutoLineModal.show<Temporal.PlainDate>({
            propertyRoute: OrderEntity.propertyRoute(a => a.shippedDate),
            initialValue,
            modalSize: "sm",
        });
    }
}
