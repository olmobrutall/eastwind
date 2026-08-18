import "@altea/altea/client/EntityTypeApi"; // installs Type.token / findOptions / … statics
import { type RouteObject } from "react-router";
import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { EmployeesClient } from "./employees/Employee.client";
import { ProductsClient } from "./products/Product.client";
import { ShippersClient } from "./shippers/Shipper.client";
import { CustomersClient } from "./customers/Customer.client";
import { OrdersClient } from "./orders/Order.client";
import { AuthAdminClient } from "@altea/altea-auth/client/admin/AuthAdminClient";
import { ProfilerClient } from "@altea/altea-profiler/client/ProfilerClient";
import { UserQueriesClient } from "@altea/altea-user-queries/client/UserQueriesClient";
import { ChartClient } from "@altea/altea-chart/client/ChartClient";
import { ColorPaletteClient } from "@altea/altea-chart/client/ColorPalette/ColorPaletteClient";
import { UserChartClient } from "@altea/altea-chart/client/UserChart/UserChartClient";
import { DashboardClient } from "@altea/altea-dashboard/client/DashboardClient";
import { FilesClient } from "@altea/altea-files/client/FilesClient";
import { OmniboxClient } from "@altea/altea-omnibox/client/OmniboxClient";

// The full (admin) registration bundle — Southwind's MainAdmin.startFull: the framework client modules
// (Operations/Navigator/Finder) first, then each entity domain's client. Mirrors the server's
// Starter.start threading a single SchemaBuilder — here one ClientBuilder (`cb`) owns the routes and is
// threaded through every domain's `start(cb)`. eastwind has no extensions and (for now) no auth, so
// MainPublic always calls this. Importing the *Client modules also registers every entity type on the
// client (needed for token resolution + operation→type mapping).
export function startFull(routes: RouteObject[]): void {
    const cb = new ClientBuilder(routes);
    cb.startFramework();

    // Files (altea-files): the file lines / downloader used by the domain views (Category.picture).
    FilesClient.start(cb);

    EmployeesClient.start(cb);
    ProductsClient.start(cb);
    ShippersClient.start(cb);
    CustomersClient.start(cb);
    OrdersClient.start(cb);

    // Authorization admin (altea-auth, part of the FULL bundle): the User/Role admin views + rule-pack
    // admin. The PUBLIC auth routes (login / change password) are registered by AuthClient.startPublic
    // in MainPublic — they must work without this admin bundle.
    AuthAdminClient.start(cb, { types: true, permissions: true, operations: true, queries: true, properties: true });

    // Profiler admin (altea-profiler): the /profiler/heavy + /profiler/times pages (Signum's ProfilerClient).
    ProfilerClient.start(cb);

    // User queries (altea-user-queries): the UserQuery editor + /userQuery page + quick-links to run saved
    // queries (Signum's UserQueryClient).
    UserQueriesClient.start(cb);

    // Charting (altea-chart): the /chart/:queryName page + the Columns D3 renderer (Signum's ChartClient).
    ChartClient.start(cb);

    // Per-type color palettes (altea-chart/ColorPalette): the ColorPalette editor + client palette cache
    // (Signum's ColorPaletteClient, which it starts from within ChartClient.start — altea wires it here from
    // MainAdmin to match how every other client is registered). After ChartClient.
    ColorPaletteClient.start(cb);

    // User charts (altea-chart/UserChart): the UserChart editor + /userChart page + quick-links to run saved
    // charts (Signum's UserChartClient). After ChartClient so the chart-script catalog fetch is registered.
    UserChartClient.start(cb);

    // Dashboards (altea-dashboard): the dashboard editor + /dashboard/:id page + the embedded-dashboard
    // widgets and quick-links (Signum's DashboardClient). LAST: the UserQuery / UserChart clients register
    // their part renderers into the dashboard registry from their own start(cb) (which runs above), and the
    // dashboard editor only reads that registry when a dashboard is actually opened.
    DashboardClient.start(cb);

    // Omnibox (altea-omnibox): registers the three result-shape renderers the navbar's
    // <OmniboxAutocomplete/> (see Layout.tsx) draws its suggestions with. Registers no routes.
    OmniboxClient.start(cb);
}
