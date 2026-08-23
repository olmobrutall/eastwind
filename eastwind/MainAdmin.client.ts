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
import { FilesClient } from "@altea/altea-files/client/FilesClient";
import { SchedulerClient } from "@altea/altea-scheduler/client/SchedulerClient";
import { ProcessClient } from "@altea/altea-processes/client/ProcessClient";
import { OmniboxClient } from "@altea/altea-omnibox/client/OmniboxClient";
import { MapClient } from "@altea/altea-map/client/MapClient";
import { HelpClient } from "@altea/altea-help/client/HelpClient";
import { MigrationsClient } from "@altea/altea-migrations/client/MigrationsClient";
import { AlertsClient } from "@altea/altea-alert/client/AlertsClient";
import { ToolbarClient } from "@altea/altea-toolbar/client/ToolbarClient";
import { MailingClient } from "@altea/altea-email/client/MailingClient";
import { MailingReceptionClient } from "@altea/altea-email/client/MailingReceptionClient";
import { MailingExchangeWSClient } from "@altea/altea-mailing-exchange/client/MailingExchangeWSClient";
import { MailingMicrosoftGraphClient } from "@altea/altea-mailing-microsoft-graph/client/MailingMicrosoftGraphClient";
import { RemoteEmailsClient } from "@altea/altea-mailing-microsoft-graph/client/RemoteEmails/RemoteEmailsClient";
import { MailingPop3Client } from "@altea/altea-mailing-pop3/client/MailingPop3Client";
import { OfficeClient } from "@altea/altea-office-template/client/OfficeClient";
import { HtmlEditorClient } from "@altea/altea-html-editor/client/HtmlEditorClient";
import { MarkdownClient } from "@altea/altea-markdown/client/MarkdownClient";
import { PrintClient } from "@altea/altea-printing/client/PrintClient";
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
import { TranslationClient } from "@altea/altea-translations/client/TranslationClient";
import { TranslatedInstanceClient } from "@altea/altea-translations/client/TranslatedInstanceClient";
import { DynamicViewClient } from "@altea/altea-dynamic/client/DynamicViewClient";
import { DynamicClient } from "@altea/altea-dynamic/client/DynamicClient";
import { EvalClient } from "@altea/altea-eval/client/EvalClient";

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

    // Html editor (altea-html-editor): registers the "Html" cell formatter, so a query column whose token
    // carries format "Html" renders through the read-only viewer instead of showing raw markup. Registers no
    // routes and no entity settings — the EDITOR is a line component the views below import directly.
    // Before the modules whose searches have html columns (the email + office templates).
    HtmlEditorClient.start();

    // Markdown (altea-markdown): the same shape one format down — the "Markdown" cell formatter, so a query
    // column whose token carries format "Markdown" renders as rendered markdown rather than as its source.
    // Registers nothing else; its `MarkdownLine` is a line component the views import directly (the tour
    // step description and the agent skill instructions, exactly as in Signum).
    MarkdownClient.start();

    // Print queue (altea-printing): the PrintLine / PrintPackage views, the /printing/view panel and the
    // omnibox entry that reaches it.
    PrintClient.start(cb);

    EmployeesClient.start(cb);
    ProductsClient.start(cb);
    ShippersClient.start(cb);
    DepartmentsClient.start(cb);
    CustomersClient.start(cb);
    OrdersClient.start(cb);

    // The app GLOBALS (Southwind's GlobalsClient): the ApplicationConfiguration page — one tab per module,
    // each rendering that module's own configuration view. AFTER the domains and BEFORE the module clients
    // whose configuration views it embeds (they register those views from their own start(cb) below, and the
    // page only resolves them when it is opened).
    GlobalsClient.start(cb);

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

    // Agent (@altea/altea-agent): the SkillCode / SkillCustomization / Agent editors and the language-model
    // editors (AgentClient starts LanguageModelClient itself), then the chat entity views. The two UI TOOLS
    // are what makes the server-declared `Confirm` / `GetUIContext` tools answerable in the browser — without
    // registering them the model can call them and nothing ever replies.
    AgentClient.start(cb);
    ChatbotClient.start(cb);
    ChatbotClient.registerUITool(new ConfirmUITool());
    ChatbotClient.registerUITool(new GetUIContextUITool());

    // Concurrent users (altea-concurrent-user): the entity-frame widget showing who else has this entity
    // open, whether they are typing, and whether the copy on screen is already stale. Registers itself on
    // `onWidgets`, so it applies to every entity view without per-type configuration.
    ConcurrentUserClient.start();

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

    // The two extra SENDER service editors (@altea/altea-mailing-exchange, -microsoft-graph) and the POP3
    // reception service editor — each is one `cb.configure(T).withView(…)`, which is also what registers the
    // type on the client so the polymorphic `service` picker can offer it.
    MailingExchangeWSClient.start(cb);
    MailingMicrosoftGraphClient.start(cb);
    MailingPop3Client.start(cb);

    // The inbound half's own editors + the extra tab a RECEIVED EmailMessage grows. AFTER MailingClient: the
    // tab is an `overrideView` on EmailMessage's EntitySettings, which MailingClient registers.
    MailingReceptionClient.start(cb);

    // Browsing a user's real Outlook mailbox (the RemoteEmails half). Registered unconditionally on the
    // client — the search page simply has no rows unless the server side is enabled
    // (EASTWIND_REMOTE_EMAILS) and an Entra tenant is configured.
    RemoteEmailsClient.start(cb);

    // Office reports (altea-office-template): the template editor, the "create report" operation, the
    // contextual menu on a search's selected rows, the query-toolbar button and the entity-frame button.
    OfficeClient.start(cb, { contextual: true, queryButton: true, entityButton: true });

    // Alerts (@altea/altea-alert): the Alert view + its search settings (the Text column renders its
    // placeholders as links), the alert operations' buttons and the "alerts about this entity" quick link.
    // The navbar BELL is a component the app places itself — see Layout.tsx.
    AlertsClient.start(cb);

    // Migrations (altea-migrations): the query settings for the three history tables (SqlMigration /
    // CSharpMigration / LoadMethodLog). Signum has no client module for them — see MigrationsClient.
    MigrationsClient.start(cb);

    // Omnibox (altea-omnibox): registers the three result-shape renderers the navbar's
    // <OmniboxAutocomplete/> (see Layout.tsx) draws its suggestions with. Registers no routes.
    OmniboxClient.start(cb);

    // Schema / operation map (@altea/altea-map): the /map and /map/:type pages, the omnibox suggestion and
    // the built-in colour providers. AFTER OmniboxClient.start, which creates the provider registry this
    // one registers into.
    MapClient.start(cb);

    // In-app documentation (@altea/altea-help): the five help pages, the in-place editors, the "?" widget on
    // every entity frame + the per-line help badge, the export quick link, and the omnibox provider and
    // "!ImportHelp" special action. AFTER OmniboxClient.start (the provider registry) and AFTER
    // HtmlEditorClient.start (its editors are the description editor).
    HelpClient.start(cb);

    // Dynamic views (altea-dynamic). This one is load-bearing beyond its own editors: it installs a
    // ViewDispatcher that prefers a view stored in the DATABASE over the compiled one, for every type. With
    // no DynamicView rows saved, every type keeps rendering exactly as before — the dispatcher falls through
    // to the static view (or the auto-generated one).
    DynamicViewClient.start(cb);
    DynamicClient.start(cb);

    // Eval module (@altea/altea-eval): registers nothing today (the dynamic panel that reads its
    // eval-errors endpoint belongs to altea-dynamic above) — see EvalClient's header. Kept so the module
    // has the same wiring as every other, and so its script EDITORS are reachable from one import.
    EvalClient.start(cb);

    // Workflow (@altea/altea-workflow): the BPMN designer page, the case-activity page/modal + the Inbox's
    // Finder settings, every case/workflow operation's button behaviour, and the two toolbar configs. AFTER
    // ToolbarClient.start / DynamicClient.start — the configs it registers land in registries those own, and
    // its designer views must be the last word on the workflow types.
    WorkflowClient.start(cb);

    // eastwind makes ORDER a case main entity (see eastwindWorkflow.server.ts), and the app declares
    // CaseActivityMixin on EmailMessageEntity, so the mixin's read-only line goes on the email view after its
    // `target` — Signum hard-codes that pair in WorkflowClient.start; altea takes it per type.
    if (CaseActivityMixin.isDeclaredOn(EmailMessageEntity))
        WorkflowClient.overrideCaseActivityMixinView(EmailMessageEntity, a => a.target);

    // DiffLog (altea-diff-log): the OperationLog view — the 7-tab strip that walks the log chain of one
    // entity and diffs each pair of dumps — plus the log search's default columns. LAST, so its
    // `cb.configure(OperationLogEntity)` is the app's final word on that type.
    DiffLogClient.start(cb);

    // TimeMachine (altea-time-machine): the quick link + the "Time Machine" entry in every search
    // control's menu, the /timeMachine page route, and the search-result markers that flag a row
    // version as created / deleted. AFTER DiffLogClient, whose DiffDocument the page's data tab uses.
    TimeMachineClient.start(cb);

    // Tree (altea-tree): the /tree/:typeName page, the Move/Copy modals, the "sitemap" button on every
    // tree type's search control, the omnibox suggestion and the UserTreePart dashboard renderer. AFTER
    // DashboardClient / UserQueriesClient, whose registries it writes into. The app's tree TYPE is
    // configured separately, by DepartmentsClient above — the two are independent.
    TreeClient.start(cb);

    // Rest (altea-rest): the API-key editor with its generate button, and the request log with its
    // replay-and-diff tabs. `registerAuthenticator` is what lets `?apiKey=…` in the address bar log a
    // caller in — the flow that lands an API client inside the app already authenticated. It is a separate
    // call in Signum too, because a host may want the key ENTITY without letting a url parameter log
    // anyone in; eastwind opts in, as Southwind does.
    RestClient.start(cb);
    RestApiKeyClient.start(cb);
    RestApiKeyClient.registerAuthenticator();

    // ViewLog (altea-view-log): the global "who has looked at this?" quick link on every entity, plus the
    // log's own search columns. LAST of the log modules, so its quick link sits after the operation log's.
    ViewLogClient.start(cb);

    // SMS (altea-sms): the template editor with its live remaining-character count, the message / package
    // views, and the "SMS messages" quick link on every registered owner type (eastwind: Customer).
    SMSClient.start(cb);

    // Tour (altea-tour): implements core's TourButton extension point, registers the tour editor views,
    // and hangs the tour button on entity frames, dashboard pages and user-query search controls. AFTER
    // DashboardClient / UserQueriesClient, whose extension points it pushes onto.
    TourClient.start(cb);

    // Translations (altea-translations): the four code pages + the three instance pages, the two omnibox
    // "!TranslateCode" / "!TranslateInstances" actions, and the LINE TASK that puts a translate button on
    // every @translatable text line. AFTER OmniboxClient, whose special-action registry it pushes onto.
    TranslationClient.start(cb);
    TranslatedInstanceClient.start(cb);
}
