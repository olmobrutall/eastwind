import { Finder } from "@altea/altea/client/Finder";
import { OrderEntity } from "./Order.data";

// Orders domain client (Southwind's OrdersClient): registers Finder/Navigator settings for the Orders
// entities. Importing the entity module also registers its types on the client (token resolution).
export namespace OrdersClient {
    export function start(): void {
        Finder.addSettings(
            OrderEntity.querySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.customer),
                    token(a => a.employee),
                    token(a => a.orderDate),
                    token(a => a.state),
                ],
            })),
        );
    }
}
