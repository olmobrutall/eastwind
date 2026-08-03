import "@altea/altea/client/EntityTypeApi"; // installs Type.token / findOptions / … statics
import { type RouteObject } from "react-router";
import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { EmployeesClient } from "./employees/Employee.client";
import { ProductsClient } from "./products/Product.client";
import { ShippersClient } from "./shippers/Shipper.client";
import { CustomersClient } from "./customers/Customer.client";
import { OrdersClient } from "./orders/Order.client";

// The full (admin) registration bundle — Southwind's MainAdmin.startFull: the framework client modules
// (Operations/Navigator/Finder) first, then each entity domain's client. Mirrors the server's
// Starter.start threading a single SchemaBuilder — here one ClientBuilder (`cb`) owns the routes and is
// threaded through every domain's `start(cb)`. eastwind has no extensions and (for now) no auth, so
// MainPublic always calls this. Importing the *Client modules also registers every entity type on the
// client (needed for token resolution + operation→type mapping).
export function startFull(routes: RouteObject[]): void {
    const cb = new ClientBuilder(routes);
    cb.startFramework();

    EmployeesClient.start(cb);
    ProductsClient.start(cb);
    ShippersClient.start(cb);
    CustomersClient.start(cb);
    OrdersClient.start(cb);
}
