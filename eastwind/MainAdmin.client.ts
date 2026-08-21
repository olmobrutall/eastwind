import "@altea/altea/client/EntityTypeApi"; // installs Type.token / findOptions / … statics
import { type RouteObject } from "react-router";
import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { EmployeesClient } from "./employees/EmployeeClient.client";
import { ProductsClient } from "./products/ProductClient.client";
import { ShippersClient } from "./shippers/ShipperClient.client";
import { CustomersClient } from "./customers/CustomerClient.client";
import { OrdersClient } from "./orders/OrderClient.client";
import { AuthAdminClient } from "@altea/altea-auth/client/admin/AuthAdminClient";
import { ActiveDirectoryClient } from "@altea/altea-auth/client/admin/ActiveDirectoryClient";
import { AzureADClient } from "@altea/altea-auth-azuread/client/AzureADClient";
import { OpenIDAdminClient } from "@altea/altea-auth-openid/client/OpenIDAdminClient";
import { ResetPasswordClient } from "@altea/altea-auth-reset-password/client/ResetPasswordClient";
import { WindowsADClient } from "@altea/altea-auth-windowsad/client/WindowsADClient";
import { ProfilerClient } from "@altea/altea-profiler/client/ProfilerClient";
import { CacheClient } from "@altea/altea-cache/client/CacheClient";
import { UserQueriesClient } from "@altea/altea-user-queries/client/UserQueriesClient";
import { ChartClient } from "@altea/altea-chart/client/ChartClient";
import { ColorPaletteClient } from "@altea/altea-chart/client/ColorPalette/ColorPaletteClient";
import { UserChartClient } from "@altea/altea-chart/client/UserChart/UserChartClient";
import { DashboardClient } from "@altea/altea-dashboard/client/DashboardClient";
import { CultureInfoClient } from "@altea/altea/client/CultureInfoClient";
import { FilesClient } from "@altea/altea-files/client/FilesClient";
import { SchedulerClient } from "@altea/altea-scheduler/client/SchedulerClient";
import { ProcessClient } from "@altea/altea-processes/client/ProcessClient";
import { OmniboxClient } from "@altea/altea-omnibox/client/OmniboxClient";
import { ToolbarClient } from "@altea/altea-toolbar/client/ToolbarClient";
import { MailingClient } from "@altea/altea-email/client/MailingClient";
import { OfficeClient } from "@altea/altea-office-template/client/OfficeClient";

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
    // The culture table's query settings + the client half of the culture-name resolver. Before the
    // template modules, whose `culture` fields reference it.
    CultureInfoClient.start(cb);

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

    // The "invite a user from the directory" UI (altea-auth's shared BaseAD half): an extra autocomplete
    // entry on any user picker and a button on the User search page. It gates itself on the
    // ActiveDirectoryPermission.InviteUsersFromAD permission — which no role holds by default — so enabling
    // it costs nothing until a role is granted it and a directory is actually configured.
    // (Southwind passes `inviteUsers: false` because it uses no directory at all.)
    ActiveDirectoryClient.start({ inviteUsers: true });

    // Azure AD / Entra ID (@altea/altea-auth-azuread): the configuration editor, the AD-group view, the two
    // Microsoft Graph search pages and the profile-photo provider. `"cached"` serves avatars from the local
    // CachedProfilePhoto copy rather than calling Graph per render; the provider is inert for a user with no
    // `externalId`, which is every locally seeded eastwind user.
    AzureADClient.start(cb, { adGroups: true, profilePhotos: "cached" });

    // Self-service password reset (@altea/altea-auth-reset-password): the request table's query settings.
    // Its two PAGES are public and registered in MainPublic; this call is what registers the entity's client
    // TypeInfo, so /find/ResetPasswordRequest works.
    ResetPasswordClient.start(cb);

    // OpenID Connect (@altea/altea-auth-openid): just the configuration editor — the callback ROUTE is
    // public and registered in MainPublic.
    OpenIDAdminClient.start(cb);

    // Windows AD (@altea/altea-auth-windowsad): the configuration editor. `profilePhotos` is left off: the
    // Azure provider above already owns the avatar slot, and registering two providers would make every
    // avatar try Azure first and Windows AD second.
    WindowsADClient.start(cb, { profilePhotos: false });

    // Profiler admin (altea-profiler): the /profiler/heavy + /profiler/times pages (Signum's ProfilerClient).
    ProfilerClient.start(cb);

    // Cache admin (altea-cache): the /cache/statistics panel (Signum's CacheClient) — cached tables and
    // global lazies with their hit / invalidation / load statistics, plus Enable / Disable / Clear.
    CacheClient.start(cb);

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

    // Toolbar (altea-toolbar): the Toolbar / ToolbarMenu / ToolbarSwitcher editors + the QueryToolbarConfig.
    // LAST of the asset modules: the UserQuery / UserChart / Dashboard clients register THEIR toolbar configs
    // from their own start(cb) above, and the element editor reads that registry when a toolbar is opened.
    ToolbarClient.start(cb);

    // Scheduler (altea-scheduler): the /scheduler/view panel + the ScheduledTask / schedule-rule /
    // HolidayCalendar editors (Signum's SchedulerClient).
    SchedulerClient.start(cb);

    // Processes (altea-processes): the /processes/view panel + the Process editor (Signum's ProcessClient).
    // After SchedulerClient: a ScheduledTask can point at a ProcessAlgorithmSymbol (the scheduler bridge).
    ProcessClient.start(cb);

    // Email + templating (altea-email, which starts altea-templating itself): the EmailMessage /
    // EmailTemplate / EmailMasterTemplate / EmailSenderConfiguration editors, the /asyncEmailSender/view
    // panel, the "send this template" contextual menu + query button, and the "emails of this entity"
    // quick-link (Southwind's `MailingClient.start({ routes, contextual: true, queryButton: true })`).
    // AFTER UserQueriesClient: the template editor's filter builder is altea-user-queries' shared
    // FilterBuilderEmbedded.
    MailingClient.start(cb, { contextual: true, queryButton: true });

    // Office reports (altea-office-template): the template editor, the "create report" operation, the
    // contextual menu on a search's selected rows, the query-toolbar button and the entity-frame button.
    OfficeClient.start(cb, { contextual: true, queryButton: true, entityButton: true });

    // Omnibox (altea-omnibox): registers the three result-shape renderers the navbar's
    // <OmniboxAutocomplete/> (see Layout.tsx) draws its suggestions with. Registers no routes.
    OmniboxClient.start(cb);
}
