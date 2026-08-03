import "@altea/altea/client/EntityTypeApi"; // installs Type.token / Type.querySettings statics
import { type RouteObject } from "react-router";
import { Navigator } from "@altea/altea/client/Navigator";
import { Finder } from "@altea/altea/client/Finder";
import { Operations } from "@altea/altea/client/Operations";
import { EmployeesClient } from "./employees/Employee.client";
import { ProductsClient } from "./products/Product.client";
import { ShippersClient } from "./shippers/Shipper.client";
import { CustomersClient } from "./customers/Customer.client";
import { OrdersClient } from "./orders/Order.client";

// The full (admin) registration bundle — Southwind's MainAdmin.startFull: the framework client modules
// (Operations/Navigator/Finder) first, then each entity domain's client. eastwind has no extensions and
// (for now) no auth, so MainPublic always calls this. Importing the *Client modules also registers every
// entity type on the client (needed for token resolution + operation→type mapping).
export function startFull(routes: RouteObject[]): void {
    Operations.start();
    Navigator.start({ routes });
    Finder.start({ routes });

    EmployeesClient.start();
    ProductsClient.start();
    ShippersClient.start();
    CustomersClient.start();
    OrdersClient.start();
}
