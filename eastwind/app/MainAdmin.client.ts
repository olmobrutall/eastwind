import "@altea/altea/client/EntityTypeApi"; // installs Type.token / findOptions / … statics
import { type RouteObject } from "react-router";
import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { EmployeesClient } from "./employees/EmployeeClient.client";
import { ProductsClient } from "./products/ProductClient.client";
import { ShippersClient } from "./shippers/ShipperClient.client";
import { DepartmentsClient } from "./departments/DepartmentClient.client";
import { CustomersClient } from "./customers/CustomerClient.client";
import { OrdersClient } from "./orders/OrderClient.client";
import { GlobalsClient } from "./globals/GlobalsClient.client";
import { AuthAdminClient } from "@altea/altea-auth/client/admin/AuthAdminClient";
import { ChangeLogClient } from "@altea/altea/client/Basics/ChangeLogClient";
import { ActiveDirectoryClient } from "@altea/altea-auth/client/admin/ActiveDirectoryClient";
import { AzureADClient } from "@altea/altea-auth-azuread/client/AzureADClient";
import { OpenIDAdminClient } from "@altea/altea-auth-openid/client/OpenIDAdminClient";
import { ResetPasswordClient } from "@altea/altea-auth-reset-password/client/ResetPasswordClient";
import { WindowsADClient } from "@altea/altea-auth-windowsad/client/WindowsADClient";
import { ProfilerClient } from "@altea/altea-profiler/client/ProfilerClient";
import { CacheClient } from "@altea/altea-cache/client/CacheClient";
import { ConcurrentUserClient } from "@altea/altea-concurrent-user/client/ConcurrentUserClient";
import { AgentClient } from "@altea/altea-agent/client/AgentClient";
import { ChatbotClient } from "@altea/altea-agent/client/ChatbotClient";
import { ConfirmUITool } from "@altea/altea-agent/client/Skills/ConfirmUITool";
import { GetUIContextUITool } from "@altea/altea-agent/client/Skills/GetUIContextUITool";
import { UserQueriesClient } from "@altea/altea-user-queries/client/UserQueriesClient";
import { ChartClient } from "@altea/altea-chart/client/ChartClient";
import { ColorPaletteClient } from "@altea/altea-chart/client/ColorPalette/ColorPaletteClient";
import { UserChartClient } from "@altea/altea-chart/client/UserChart/UserChartClient";
import { DashboardClient } from "@altea/altea-dashboard/client/DashboardClient";
import { CultureInfoClient } from "@altea/altea/client/CultureInfoClient";
import { SystemEventLogClient } from "@altea/altea/client/SystemEventLogClient";
import { TokenMigrationClient } from "@altea/altea-user-assets/client/TokenMigrationClient";
import { FilesClient } from "@altea/altea-files/client/FilesClient";
import { SchedulerClient } from "@altea/altea-scheduler/client/SchedulerClient";
import { ProcessClient } from "@altea/altea-processes/client/ProcessClient";
import { OmniboxClient } from "@altea/altea-omnibox/client/OmniboxClient";
import { MapClient } from "@altea/altea-map/client/MapClient";
import { HelpClient } from "@altea/altea-help/client/HelpClient";
import { MigrationsClient } from "@altea/altea-migrations/client/MigrationsClient";
import { NotesClient } from "@altea/altea-notes/client/NotesClient";
import { AlertsClient } from "@altea/altea-alert/client/AlertsClient";
import { ToolbarClient } from "@altea/altea-toolbar/client/ToolbarClient";
import { MailingClient } from "@altea/altea-email/client/MailingClient";
import { MailingReceptionClient } from "@altea/altea-email/client/MailingReceptionClient";
import { MailingExchangeWSClient } from "@altea/altea-mailing-exchange/client/MailingExchangeWSClient";
import { MailingMicrosoftGraphClient } from "@altea/altea-mailing-microsoft-graph/client/MailingMicrosoftGraphClient";
import { RemoteEmailsClient } from "@altea/altea-mailing-microsoft-graph/client/RemoteEmails/RemoteEmailsClient";
import { MailingPop3Client } from "@altea/altea-mailing-pop3/client/MailingPop3Client";
import { OfficeClient } from "@altea/altea-office-template/client/OfficeClient";
import { ExcelClient } from "@altea/altea-office-template/client/ExcelClient";
import { HtmlEditorClient } from "@altea/altea-html-editor/client/HtmlEditorClient";
import { MarkdownClient } from "@altea/altea-markdown/client/MarkdownClient";
import { PrintClient } from "@altea/altea-printing/client/PrintClient";
import { WhatsNewClient } from "@altea/altea-whats-new/client/WhatsNewClient";
import { WorkflowClient } from "@altea/altea-workflow/client/WorkflowClient";
import { CaseActivityMixin } from "@altea/altea-workflow/data/CaseActivity";
import { EmailMessageEntity } from "@altea/altea-email/data/EmailMessage";
import { DiffLogClient } from "@altea/altea-diff-log/client/DiffLogClient";
import { TimeMachineClient } from "@altea/altea-time-machine/client/TimeMachineClient";
import { TreeClient } from "@altea/altea-tree/client/TreeClient";
import { RestClient } from "@altea/altea-rest/client/RestClient";
import { RestApiKeyClient } from "@altea/altea-rest/client/RestApiKeyClient";
import { ViewLogClient } from "@altea/altea-view-log/client/ViewLogClient";
import { SMSClient } from "@altea/altea-sms/client/SMSClient";
import { TourClient } from "@altea/altea-tour/client/TourClient";
import { MachineLearningClient } from "@altea/altea-machine-learning/client/MachineLearningClient";
import { TranslationClient } from "@altea/altea-translations/client/TranslationClient";
import { TranslatedInstanceClient } from "@altea/altea-translations/client/TranslatedInstanceClient";
import { DynamicViewClient } from "@altea/altea-dynamic/client/DynamicViewClient";
import { DynamicClient } from "@altea/altea-dynamic/client/DynamicClient";
import { EvalClient } from "@altea/altea-eval/client/EvalClient";

// The full (admin) registration bundle — Southwind's MainAdmin.startFull. One `ClientBuilder` (`cb`) owns
// the routes and is threaded through every module's `start(cb)`, mirroring the server's single
// SchemaBuilder. Importing a *Client module is also what registers its entity types on the client (needed
// for token resolution and operation→type mapping).
//
// Kept as THIN as Southwind's — one line per module — and ordered by DEPENDENCY, the same way the Starter
// is: the framework first, then each altea module after the ones whose registries it writes into, and the
// APP's own domains last. Every ordering constraint is recorded in **docs/Wiring.md**; read it before
// moving a call. `legacyMode` gates the modules Southwind does not install, in step with the server.
export function startFull(routes: RouteObject[], legacyMode = false): void {
    const cb = new ClientBuilder(routes);
    cb.startFramework();

    // ==== The FRAMEWORK (@altea/altea) ==============================================================

    // Before the template modules, whose `culture` fields reference it.
    CultureInfoClient.start(cb);
    SystemEventLogClient.start(cb);

    // The navbar button and its unread badge. `mainChangeLog` is the APP's own timeline; every module
    // registers its own with one line, and the framework's is registered by `start` itself.
    ChangeLogClient.start({ applicationName: "Eastwind", mainChangeLog: () => import("./Changelog.client") });

    // These two register a CELL FORMATTER only ("Html" / "Markdown" query-column format) — their editor /
    // MarkdownLine are line components the views import directly. Before the modules whose searches have
    // such columns (the email + office templates).
    HtmlEditorClient.start();
    MarkdownClient.start();

    // The query settings for the three migration history tables. Signum has no client module for them.
    MigrationsClient.start(cb);

    // ==== AUTHORIZATION (@altea/altea-auth) =========================================================

    // The User/Role admin views + rule-pack admin. The PUBLIC auth routes (login / change password) are
    // registered by AuthClient.startPublic in MainPublic — they must work without this bundle.
    AuthAdminClient.start(cb, { types: true, permissions: true, operations: true, queries: true, properties: true });

    // "Invite a user from the directory": gates itself on ActiveDirectoryPermission.InviteUsersFromAD,
    // which no role holds by default. (Southwind passes false — it uses no directory at all.)
    ActiveDirectoryClient.start({ inviteUsers: true });

    // `profilePhotos: "cached"` serves avatars from the local CachedProfilePhoto copy rather than calling
    // Graph per render; inert for a user with no `externalId`, which is every locally seeded eastwind user.
    AzureADClient.start(cb, { adGroups: true, profilePhotos: legacyMode ? false : "cached" });
    // The reset-request table's query settings; its two PAGES are public (MainPublic).
    ResetPasswordClient.start(cb);
    // Just the configuration editor — the callback ROUTE is public (MainPublic).
    OpenIDAdminClient.start(cb);
    // `profilePhotos` off: the Azure provider above already owns the avatar slot.
    WindowsADClient.start(cb, { profilePhotos: false });

    // ==== FILES, CACHE, PROFILER ====================================================================

    FilesClient.start(cb);
    CacheClient.start(cb);
    ProfilerClient.start(cb);

    // Registers itself on `onWidgets`, so it applies to every entity view without per-type configuration.
    ConcurrentUserClient.start();

    // ==== SCHEDULING AND PROCESSES ==================================================================

    SchedulerClient.start(cb);
    ProcessClient.start(cb);

    // ==== USER ASSETS (each reads a registry the previous ones write into — docs/Wiring.md) =========

    TokenMigrationClient.start(cb);
    UserQueriesClient.start(cb);
    ChartClient.start(cb);
    ColorPaletteClient.start(cb);
    UserChartClient.start(cb);
    DashboardClient.start(cb);
    ToolbarClient.start(cb);

    // ==== COMMUNICATION =============================================================================

    // Southwind's `MailingClient.start({ routes, contextual: true, queryButton: true })`. AFTER
    // UserQueriesClient: the template editor's filter builder is altea-user-queries' FilterBuilderEmbedded.
    MailingClient.start(cb, { contextual: true, queryButton: true });

    // The extra SENDER / reception service editors — each is one `cb.configure(T).withView(…)`, which is
    // also what registers the type so the polymorphic `service` picker can offer it.
    // Not in Southwind — see legacyMode.
    if (!legacyMode)
        MailingExchangeWSClient.start(cb);
    MailingMicrosoftGraphClient.start(cb);
    if (!legacyMode)
        MailingPop3Client.start(cb);
    // AFTER MailingClient: its extra tab is an `overrideView` on the EntitySettings that call registers.
    if (!legacyMode)
        MailingReceptionClient.start(cb);
    // Registered unconditionally on the client — the search page simply has no rows unless the server side
    // is enabled (EASTWIND_REMOTE_EMAILS) and an Entra tenant is configured.
    if (!legacyMode)
        RemoteEmailsClient.start(cb);//Mailing

    // The navbar BELL is a component the app places itself — see Layout.tsx.
    AlertsClient.start(cb);
    NotesClient.start(cb);

    SMSClient.start(cb);

    // ==== DOCUMENTS =================================================================================

    OfficeClient.start(cb, { contextual: true, queryButton: true, entityButton: true });
    ExcelClient.start(cb, { plainExcel: true, importFromExcel: true, excelReport: true });

    // ==== PRINT QUEUE AND RELEASE NOTES =============================================================

    // Print queue. Not in Southwind — see legacyMode; gated in step with the server, since a client that
    // registered these pages against a server that never started the module would 404 on every call.
    if (!legacyMode)
        PrintClient.start(cb);//Printing

    // Release notes. Not in Southwind — see legacyMode.
    if (!legacyMode)
        WhatsNewClient.start(cb);//WhatsNew

    // ==== MACHINE LEARNING ==========================================================================

    // AFTER ChartClient — the `Full` result saver links to a Punchcard / Scatterplot chart whose script
    // keys must already be registered.
    MachineLearningClient.start(cb, routes);

    // ==== AGENT, DYNAMIC AND WORKFLOW ===============================================================

    // The two UI TOOLS are what makes the server-declared `Confirm` / `GetUIContext` tools answerable in
    // the browser — without registering them the model can call them and nothing ever replies.
    AgentClient.start(cb);
    ChatbotClient.start(cb);
    ChatbotClient.registerUITool(new ConfirmUITool());
    ChatbotClient.registerUITool(new GetUIContextUITool());//Agent

    // Load-bearing beyond its own editors: it installs a ViewDispatcher that prefers a view stored in the
    // DATABASE over the compiled one, for every type. With no DynamicView rows saved, nothing changes.
    DynamicViewClient.start(cb);
    DynamicClient.start(cb);
    // Registers nothing today (the dynamic panel that reads its eval-errors endpoint belongs to
    // altea-dynamic above) — kept so the module has the same wiring as every other.
    EvalClient.start(cb);//Dynamic

    // AFTER ToolbarClient / DynamicClient — the configs it registers land in registries those own, and its
    // designer views must be the last word on the workflow types.
    WorkflowClient.start(cb);

    // ==== CROSS-CUTTING: navigation, docs, logs =====================================================

    // Registers the three result-shape renderers the navbar's <OmniboxAutocomplete/> draws with, and
    // creates the provider registry the next two register into.
    OmniboxClient.start(cb);
    MapClient.start(cb);
    // AFTER OmniboxClient (the provider registry) and AFTER HtmlEditorClient (its editors are the
    // description editor).
    HelpClient.start(cb);

    // AFTER DashboardClient / UserQueriesClient, whose registries it writes into. The app's tree TYPE is
    // configured separately, by DepartmentsClient below.
    // Not in Southwind — see legacyMode.
    if (!legacyMode)
        TreeClient.start(cb);

    // AFTER DashboardClient / UserQueriesClient, whose extension points it pushes onto.
    // Not in Southwind — see legacyMode.
    if (!legacyMode)
        TourClient.start(cb);

    // `registerAuthenticator` is what lets `?apiKey=…` in the address bar log a caller in. A separate call
    // in Signum too, because a host may want the key ENTITY without that; eastwind opts in, as Southwind does.
    RestClient.start(cb);
    RestApiKeyClient.start(cb);
    RestApiKeyClient.registerAuthenticator();//Rest

    // LAST word on OperationLogEntity; TimeMachine then uses its DiffDocument.
    DiffLogClient.start(cb);
    TimeMachineClient.start(cb);

    // LAST of the log modules, so its quick link sits after the operation log's.
    ViewLogClient.start(cb);

    // AFTER OmniboxClient, whose special-action registry it pushes onto.
    TranslationClient.start(cb);
    TranslatedInstanceClient.start(cb);//Translation

    // ==== THE APP (eastwind) ========================================================================
    //
    // Everything above is framework or module; everything below is this application.

    EmployeesClient.start(cb);
    ProductsClient.start(cb);
    ShippersClient.start(cb);
    CustomersClient.start(cb);
    OrdersClient.start(cb);
    // The app's TREE type (the module itself is started above).
    // Not in Southwind — see legacyMode.
    if (!legacyMode)
        DepartmentsClient.start(cb);//Departments

    // The app GLOBALS (Southwind's GlobalsClient): the ApplicationConfiguration page — one tab per module,
    // each rendering that module's own configuration view — plus the UserEmployeeMixin line on the User
    // view. AFTER AuthAdminClient, which registers UserEntity's own EntitySettings (docs/Wiring.md).
    GlobalsClient.start(cb);

    // eastwind declares CaseActivityMixin on EmailMessageEntity, so the mixin's read-only line goes on the
    // email view after its `target` — Signum hard-codes that pair in WorkflowClient.start.
    if (CaseActivityMixin.isDeclaredOn(EmailMessageEntity))
        WorkflowClient.overrideCaseActivityMixinView(EmailMessageEntity, a => a.target);//Workflow
}
