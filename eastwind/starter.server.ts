import "@altea/altea/server/context.node"; // register server context storage first
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // sb.include(...).withQuery()
import { Connector } from "@altea/altea/server/connection/connector";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { TypeEntity } from "@altea/altea/data/typeEntity";
import type { Entity, Type } from "@altea/altea/data/entity";
import { SignumServer } from "@altea/altea/server/signumServer";
import type { WebBuilder } from "@altea/altea/server/webApi";
import { ExceptionLogic } from "@altea/altea/server/exceptionLogic";
import { CultureInfoLogic } from "@altea/altea/server/cultureInfoLogic";
import { OperationLogic } from "@altea/altea/server/operationLogic";
import { loadAppTranslations } from "@altea/altea/server/translations";
import { EntityOverrides } from "./entityOverrides.data";
import { EmployeesLogic } from "./employees/EmployeeLogic.server";
import { ProductsLogic } from "./products/ProductLogic.server";
import { ShippersLogic } from "./shippers/ShipperLogic.server";
import { DepartmentsLogic } from "./departments/DepartmentLogic.server";
import { CustomersLogic } from "./customers/CustomerLogic.server";
import { OrdersLogic } from "./orders/OrderLogic.server";
import { OrderEntity } from "./orders/Order.data";
import { CustomerEntity, PersonEntity, CompanyEntity } from "./customers/Customer.data";
import { AuthLogic } from "@altea/altea-auth/server/AuthLogic";
import { TypeAuthLogic } from "@altea/altea-auth/server/TypeAuthLogic";
import { PermissionAuthLogic } from "@altea/altea-auth/server/PermissionAuthLogic";
import { OperationAuthLogic } from "@altea/altea-auth/server/OperationAuthLogic";
import { QueryAuthLogic } from "@altea/altea-auth/server/QueryAuthLogic";
import { PropertyAuthLogic } from "@altea/altea-auth/server/PropertyAuthLogic";
import { TypeConditionLogic } from "@altea/altea-auth/server/TypeConditionLogic";
import { UserEntity } from "@altea/altea-auth/data/User";
import { UserHolder } from "@altea/altea/server/userHolder";
import { ProfilerLogic } from "@altea/altea-profiler/server/ProfilerLogic";
import { UserQueriesLogic } from "@altea/altea-user-queries/server/UserQueriesLogic.server";
import { ChartLogic } from "@altea/altea-chart/server/ChartLogic.server";
import { ColorPaletteLogic } from "@altea/altea-chart/server/ColorPaletteLogic.server";
import { UserChartLogic } from "@altea/altea-chart/server/UserChartLogic.server";
import { DashboardLogic } from "@altea/altea-dashboard/server/DashboardLogic.server";
import { FileLogic } from "@altea/altea-files/server/FileLogic.server";
import { SchedulerLogic } from "@altea/altea-scheduler/server/SchedulerLogic.server";
import { SimpleTaskLogic } from "@altea/altea-scheduler/server/SimpleTaskLogic.server";
import { ScheduleTaskRunner } from "@altea/altea-scheduler/server/ScheduleTaskRunner.server";
import { ProcessRunner } from "@altea/altea-processes/server/ProcessRunner.server";
import { AsyncEmailSender } from "@altea/altea-email/server/AsyncEmailSender.server";
import { ProcessLogic } from "@altea/altea-processes/server/ProcessLogic.server";
import { ProcessSchedulerBridge } from "@altea/altea-processes/server/ProcessSchedulerBridge.server";
import { OmniboxLogic } from "@altea/altea-omnibox/server/OmniboxLogic";
import { MapLogic } from "@altea/altea-map/server/MapLogic.server";
import { HelpModuleLogic } from "@altea/altea-help/server/HelpModuleLogic.server";
import { DiffLogLogic } from "@altea/altea-diff-log/server/DiffLogLogic";
import { TimeMachineLogic } from "@altea/altea-time-machine/server/TimeMachineLogic.server";
import { TreeModuleLogic } from "@altea/altea-tree/server/TreeModuleLogic.server";
import { RestModuleLogic } from "@altea/altea-rest/server/RestModuleLogic.server";
import { ViewLogLogic } from "@altea/altea-view-log/server/ViewLogLogic.server";
import { SMSModuleLogic } from "@altea/altea-sms/server/SMSModuleLogic.server";
import { SMSLogic } from "@altea/altea-sms/server/SMSLogic.server";
import { SMSProcessLogic } from "@altea/altea-sms/server/SMSProcessLogic.server";
import { UserQueryEntity } from "@altea/altea-user-queries/data/UserQuery";
import { UserChartEntity } from "@altea/altea-chart/data/UserChart";
import { DashboardEntity } from "@altea/altea-dashboard/data/Dashboard";
import { CatalogApi } from "./publicApi/CatalogApi.server";
import { PublicCatalogApi } from "./publicApi/PublicCatalog.server";
import { TourLogic } from "@altea/altea-tour/server/TourLogic.server";
import { TranslationLogic } from "@altea/altea-translations/server/TranslationLogic.server";
import { WorkflowLogicStarter } from "@altea/altea-workflow/server/WorkflowLogicStarter.server";
import { OrderWorkflow } from "./orders/OrderWorkflow.server";
import { EastwindEval } from "./eastwindEval.server";
import { DynamicLogic } from "@altea/altea-dynamic/server/DynamicLogic.server";
import { EmailLogic } from "@altea/altea-email/server/EmailLogic.server";
import { EmailPackageLogic } from "@altea/altea-email/server/EmailPackageLogic.server";
import { SendEmailTaskLogic } from "@altea/altea-email/server/SendEmailTaskLogic.server";
import { FileTypeLogic } from "@altea/altea-files/server/FileTypeLogic.server";
import { FileTypeAlgorithm } from "@altea/altea-files/server/FileTypeAlgorithm.server";
import { EastwindFileStores } from "./eastwindFileStores.server";
import { EmailReceptionLogic } from "@altea/altea-email/server/EmailReceptionLogic.server";
import { MailingExchangeWSLogic } from "@altea/altea-mailing-exchange/server/MailingExchangeWSLogic";
import { MailingMicrosoftGraphLogic } from "@altea/altea-mailing-microsoft-graph/server/MailingMicrosoftGraphLogic";
import { RemoteEmailsLogic } from "@altea/altea-mailing-microsoft-graph/server/RemoteEmailsLogic";
import { Pop3ConfigurationLogic } from "@altea/altea-mailing-pop3/server/Pop3ConfigurationLogic";
import { EmailFileType } from "@altea/altea-email/data/Email";
import { OfficeTemplateLogic } from "@altea/altea-office-template/server/OfficeTemplateLogic.server";
import { ToolbarLogic } from "@altea/altea-toolbar/server/ToolbarLogic.server";
import { PlainExcelLogic } from "@altea/altea-office-template/server/excel/PlainExcelLogic.server";
import { ExcelImportLogic } from "@altea/altea-office-template/server/excel/ExcelImportLogic.server";
import { MigrationLogic } from "@altea/altea-migrations/server/MigrationLogic.server";
import { EastwindTypeCondition, EastwindAgentUseCases, EastwindFileType } from "./globals/ApplicationConfiguration.data";
import { PrintingLogic } from "@altea/altea-printing/server/PrintingLogic.server";
import { PrintingServer } from "@altea/altea-printing/server/PrintingServer.server";
import { WhatsNewLogic } from "@altea/altea-whats-new/server/WhatsNewLogic.server";
import { WhatsNewServer } from "@altea/altea-whats-new/server/WhatsNewServer.server";
import { WhatsNewFileType } from "@altea/altea-whats-new/data/WhatsNew";
import { GlobalsLogic } from "./globals/GlobalsLogic.server";
import { CacheLogic } from "@altea/altea-cache/server/CacheLogic";
import { ConcurrentUserLogic } from "@altea/altea-concurrent-user/server/ConcurrentUserLogic.server";
import { ChatbotLogic } from "@altea/altea-agent/server/ChatbotLogic";
import { AgentLogic } from "@altea/altea-agent/server/AgentLogic";
import { AgentMcpServer } from "@altea/altea-agent/server/AgentMcpServer";
import { ChatbotServer } from "@altea/altea-agent/server/ChatbotServer";
import { EastwindAgent } from "./eastwindAgent.server";
import { AzureADLogic } from "@altea/altea-auth-azuread/server/AzureADLogic";
import { CachedProfilePhotoLogic } from "@altea/altea-auth-azuread/server/CachedProfilePhotoLogic";
import { OpenIDLogic } from "@altea/altea-auth-openid/server/OpenIDLogic";
import { WindowsADLogic } from "@altea/altea-auth-windowsad/server/WindowsADLogic";
import { ResetPasswordRequestLogic } from "@altea/altea-auth-reset-password/server/ResetPasswordRequestLogic";
import { EastwindAuthAD } from "./eastwindAuthAD.server";
import { CurrentServerContextSkill } from "@altea/altea-agent/server/Skills/CurrentServerContextSkill";
import { IntroductionSkill } from "@altea/altea-agent/server/Skills/IntroductionSkill";
import { AlertLogic } from "@altea/altea-alert/server/AlertLogic.server";
import { NoteLogic } from "@altea/altea-notes/server/NoteLogic.server";
import { AlertNotificationLogic } from "@altea/altea-alert/server/AlertNotificationLogic.server";
import { CacheServer } from "@altea/altea-cache/server/CacheServer";

// Port of Southwind's Starter.Start (Southwind/Starter.cs): the single global entry that builds the
// schema, binds the connector, registers each module's logic and completes. Extensions are excluded
// (eastwind → altea only). The dialect is chosen inline from the connection string, mirroring Signum's
// `isPostgres` branch: "postgres…" → PostgreSQL, otherwise SQL Server.
export namespace Starter {
    // `webBuilder` mirrors Signum's `sb.WebServerBuilder`: the web host passes the WebBuilder it created,
    // Starter sets it on the SchemaBuilder, and each module's `XxxLogic.start(sb)` mounts its own HTTP
    // surface via `if (sb.webBuilder) XxxServer.start(sb.webBuilder)`. A terminal / test omits it (no HTTP).
    export async function start(connectionString: string, webBuilder?: WebBuilder): Promise<void> {
        // Shared entity-model declarations (mixins / lite models / implementedBy overrides), applied
        // identically on client and server. Runs before schema build so overrides take effect.
        EntityOverrides.start();

        var sb = new SchemaBuilder();
        sb.webBuilder = webBuilder;

        var connector = connectionString.startsWith("postgres")
            ? new (await import("@altea/altea/server/connection/postgresConnector")).PostgresConnector(sb.schema, connectionString)
            : new (await import("@altea/altea/server/connection/sqlServerConnector")).SqlServerConnector(sb.schema, connectionString);

        Connector.default = connector;
        sb.settings.isPostgres = connector.isPostgres;

        // Point eastwind at a database a SIGNUM application generated — a Southwind — and name things the
        // way Signum names them, so `terminal sync` reads as a MIGRATION (the model differences) rather
        // than a rebuild (every table renamed). See SchemaSettings.legacyMode for what it currently covers.
        // Like the dialect above, this is decided while the schema is BUILT, before a row can be read, so
        // it comes from the environment and not from the ApplicationConfiguration row.
        sb.settings.legacyMode = isEnvTrue(process.env["LegacyMode"]);

        // Cache module (altea-cache) — FIRST of all the module starts, for two reasons: it swaps the
        // global-lazy invalidation strategy (which must happen before ANY `sb.globalLazy` registration),
        // and `.withCache()` on an include below needs it started. The broadcast is what tells SIBLING
        // processes to invalidate; on Postgres that is LISTEN/NOTIFY, which needs no configuration
        // (Signum's `PostgresBroadcast`). A single-process host works fine without one — every write goes
        // through this process, so its own events cover it.
        // `PostgresBroadcast` is loaded lazily for the same reason the connector above is: it imports the
        // postgres connector, so a static import here would pull the `pg` driver into a SQL Server host.
        const serverBroadcast = connector.isPostgres
            ? new (await import("@altea/altea-cache/server/Broadcast/PostgresBroadcast")).PostgresBroadcast()
            : undefined;
        CacheLogic.start(sb, { serverBroadcast });

        // Framework logic (Signum's part of Starter.Start): the exception log table.
        ExceptionLogic.start(sb);

        // The cultures the application supports (Signum's CultureInfoLogic.Start). Early, because an email
        // or Office template REFERENCES a culture row, so the table has to exist before those modules
        // include theirs.
        CultureInfoLogic.start(sb);

        EmployeesLogic.start(sb);
        ProductsLogic.start(sb);
        ShippersLogic.start(sb);
        CustomersLogic.start(sb);
        OrdersLogic.start(sb);

        // Authentication module (altea-auth): registers RoleEntity + UserEntity, their operations, and
        // the UserGraph state machine. Before OperationLogic.start so its operation symbols get seeded.
        //
        // The two user names are Southwind's (`AuthLogic.Start(sb, "System", "Anonymous")`, Starter.cs).
        // The SECOND one is the app's unauthenticated posture: a request with no token is authenticated as
        // the "Anonymous" user, so it reaches every route and is limited by that user's ROLE RULES rather
        // than by the route-level gate. That role is seeded by `createRoles` and its rules are in
        // terminal/AuthRules.xml, which grants it Read on exactly Category + Product — the public catalog
        // (publicApi/PublicCatalog.server.ts) and nothing else. Those rules had been ported already and were
        // inert until now, because nothing ever ran as that role.
        AuthLogic.start(sb, "System", "Anonymous");
        // Authorization engine (coarse slice): Type + Permission rules. Registers Rule* tables + the
        // PermissionSymbol table.
        TypeAuthLogic.start(sb);
        PermissionAuthLogic.start(sb);
        OperationAuthLogic.start(sb);
        QueryAuthLogic.start(sb);
        PropertyAuthLogic.start(sb);
        // Southwind's `TypeConditionLogic.RegisterCompile<UserEntity>(SouthwindTypeCondition.UserEntities,
        // u => u.Is(UserEntity.Current))` (Starter.cs): "the row IS the current user", so a role can be given
        // Read on User restricted to one's own row — which is exactly what terminal/AuthRules.xml does for
        // Standard user. The same symbol also scopes the USER ASSETS by owner further down; a symbol is
        // registered per type, so both registrations are needed.
        TypeConditionLogic.registerCompile(UserEntity, EastwindTypeCondition.UserEntities,
            u => u.is(UserHolder.currentUserLite()));

        // Files module (altea-files): the FileTypeSymbol table, the save / delete hooks for every entity that
        // holds a FilePathEmbedded, and the download routes (Southwind's FilePathEmbeddedLogic.Start +
        // FileLogic.Start). MUST come after AuthLogic.start: express runs handlers in REGISTRATION order, so
        // routes mounted before the auth middleware never see an authenticated user (they 403 as "Not user
        // logged"). The field scan itself runs on `schema.initializing`, so it still covers every module's
        // file fields regardless of where this sits.
        FileLogic.start(sb);

        // Directory login modules (@altea/altea-auth-azuread / -openid / -windowsad). HERE because:
        //  - AFTER AuthLogic.start, so their routes are mounted behind the auth middleware (express matches
        //    in registration order — see FileLogic's note above);
        //  - AFTER FileLogic.start, so the FileTypeSymbol table exists for the cached-profile-photo store;
        //  - BEFORE SchedulerLogic.start, because a module's SimpleTask must be REGISTERED before the
        //    SimpleTaskSymbol table is seeded from the registered keys.
        //
        // AzureAD is started unconditionally (Southwind's `AzureADLogic.Start(sb, adGroupsAndQueries: true,
        // deactivateUsersTask: true)`), so its ADGroup / CachedProfilePhoto tables and its directory search
        // pages are part of the schema whether or not a tenant is configured. OpenID / WindowsAD contribute
        // no tables, so they are opt-in and simply REPLACE the installed authorizer (only one can own the
        // login flow — see eastwindAuthAD.server.ts).
        AzureADLogic.start(sb, {
            getConfig: () => EastwindAuthAD.azureADConfiguration(),
            adGroupsAndQueries: true,
            deactivateUsersTask: true,
        });
        // The photo store. `CachedProfilePhotoLogic.start` registers the file type itself (Signum's
        // `FileTypeLogic.Register(AuthADFileType.CachedProfilePhoto, algorithm)`), so the app only supplies
        // the algorithm — registering it here as well would be a duplicate registration.
        // Which BACKEND holds the bytes is one env var away (EASTWIND_FILE_STORE=folder|azure|s3), and the
        // store's NAME is where it writes — see eastwindFileStores.server.ts. `onlyImages` is what makes an
        // Azure / S3 store serve these INLINE.
        CachedProfilePhotoLogic.start(sb, EastwindFileStores.store("profile-photos", { onlyImages: true }));

        // OpenID contributes no tables, so it is started ALWAYS and only OWNS the login flow when it is the
        // selected provider. That keeps the client's boot probe (/api/auth/openIDConfig) a clean 200-null
        // instead of a 404 — the route exists and simply reports "not configured".
        OpenIDLogic.start(sb, () => EastwindAuthAD.openIDConfiguration(),
            { installAuthorizer: EastwindAuthAD.provider() === "openid" });

        if (EastwindAuthAD.provider() === "windowsad")
            WindowsADLogic.start(sb, {
                getConfig: () => EastwindAuthAD.windowsADConfiguration(),
                deactivateUsersTask: true,
            });

        // Scheduler module (altea-scheduler): the ScheduledTask / log tables, the SimpleTaskSymbol table and
        // the in-process runner's routes. The app's own tasks are already registered — each DOMAIN registers
        // its own in its Logic.start (eastwind/orders), which is where Southwind keeps them and is safely
        // before this call, since the SimpleTaskSymbol table is seeded from the registry here. After the auth
        // logics so ViewSchedulerPanel lands in the same permission seed, and after FileLogic for the same
        // route-ordering reason.
        SchedulerLogic.start(sb);

        // Processes module (altea-processes): the Process / Package tables and the in-process runner's
        // routes. The algorithms are registered by their own DOMAIN (see the scheduler note above), which is
        // before this call — the ProcessAlgorithmSymbol table is seeded from that registry here. The SCHEDULER
        // BRIDGE goes last: it makes a ProcessAlgorithmSymbol a valid ScheduledTask.task, so a scheduled entry
        // creates + queues a process instead of running inline. (The matching implementedBy widening is
        // declared in entityOverrides.data.ts — both tiers need it.)
        ProcessLogic.start(sb);
        ProcessSchedulerBridge.start(sb);

        // Agent module (@altea/altea-agent): the chat tables + language-model registry (ChatbotLogic) and the
        // agent / skill registry (AgentLogic). Order matters three ways: the skill CLASSES are registered
        // first (the SkillCode table is seeded from them and `registerAgent` asserts against it), the
        // chatbot's own agent is handed to AgentLogic.start so DefaultAgent.Chatbot resolves, and the app's
        // extra MCP agent is registered after — before OperationLogic.start, so its symbols get seeded.
        // AFTER the chart module: the ChartSkill reads ChartScriptLogic's registered scripts.
        CurrentServerContextSkill.urlLeft = () => GlobalsLogic.configuration().email.urlLeft;
        IntroductionSkill.applicationName = "eastwind";
        ChatbotLogic.start(sb, () => GlobalsLogic.configuration().chatbot);
        ChatbotLogic.registerUserTypeCondition(EastwindTypeCondition.UserEntities);
        AgentLogic.start(sb, EastwindAgent.chatbotSkill);
        AgentLogic.registerAgent(EastwindAgentUseCases.MCP, EastwindAgent.mcpSkill);

        // Concurrent-user module (altea-concurrent-user): the presence table plus the WebSocket hub that
        // pushes "someone else has this open / just saved it" to every tab. AFTER the auth logics (its hub
        // authenticates with the same bearer token) and after CacheLogic.start (it registers two receivers
        // on the cache's server broadcast, so a second host's saves reach this host's sockets).
        ConcurrentUserLogic.start(sb);

        // Profiler module (altea-profiler): declares no tables (state is in-memory); mounts the
        // /api/profilerHeavy/* + /api/profilerTimes/* routes and its permission symbols (seeded via the
        // PermissionSymbol table above). After the auth logics so its permissions land in the same seed.
        ProfilerLogic.start(sb, { timeTracker: true, heavyProfiler: true });

        // Cache admin surface (altea-cache): /api/cache/view + enable/disable/clear + the two anonymous
        // broadcast endpoints. Mounted HERE, not inside CacheLogic.start (which has to run before every
        // other module — see above): express matches handlers in REGISTRATION order, so a route mounted
        // ahead of the auth middleware would never see an authenticated user.
        if (sb.webBuilder)
            CacheServer.start(sb.webBuilder);

        // Agent HTTP surface (@altea/altea-agent): the streaming /api/chatbot/ask turn, the transcript and
        // feedback routes, the skill-introspection routes and the provider model catalogues. Mounted here for
        // the same reason CacheServer is — after the auth middleware, so every call sees a user.
        //
        // The MCP endpoint is separate and mounted right after: it exposes the app's MCP agent's skill tree
        // to an EXTERNAL host (Southwind does the same in Program.cs with `.WithSignumSkill(…MCP)`).
        if (sb.webBuilder) {
            ChatbotServer.start(sb.webBuilder);
            AgentMcpServer.start(sb.webBuilder, EastwindAgentUseCases.MCP);
        }

        // User queries module (altea-user-queries): the UserQuery entity + its Save/Delete operations,
        // caches, XML import/export, and lookup routes. Before OperationLogic.start so its operation symbols
        // get seeded; after the auth logics so ViewUserQuery / UserAssetsToXML land in the same permission seed.
        UserQueriesLogic.start(sb);
        // Row-level owner scoping (Southwind's UserQueryLogic.RegisterUser/RoleTypeCondition): a role whose
        // Dashboard/UserQuery/UserChart rule uses these conditions sees only its own + shared assets.
        UserQueriesLogic.registerUserTypeCondition(EastwindTypeCondition.UserEntities);
        UserQueriesLogic.registerRoleTypeCondition(EastwindTypeCondition.RoleEntities);

        // User charts module (altea-chart/UserChart): the UserChart entity + its Save/Delete operations,
        // caches, XML import/export, and lookup routes (Signum's UserChartLogic). Mirrors UserQueriesLogic;
        // its ChartScriptSymbol FK auto-includes the chart-script table, which ChartLogic.start (below) seeds.
        UserChartLogic.start(sb);
        UserChartLogic.registerUserTypeCondition(EastwindTypeCondition.UserEntities);
        UserChartLogic.registerRoleTypeCondition(EastwindTypeCondition.RoleEntities);

        // Charting module (altea-chart): seeds the ChartScriptSymbol table + registers the built-in chart
        // scripts (Bars/Columns), and mounts GET /api/chart/scripts. Before OperationLogic.start (no
        // operations yet) / after the auth logics so ViewCharting lands in the same permission seed.
        // svgMapUrls registers the opt-in SvgMap chart with the sample map served from public/ (dev: vite,
        // prod: the API host's static files). Point a String LocationCode column at its region ids (US/DE/…).
        ChartLogic.start(sb, ["/sample-maps/regions.svg"]);

        // Per-type color palettes (altea-chart/ColorPalette): the ColorPalette entity + its Save/Delete
        // operations, the palette cache, and GET /api/colorPalette/:typeName (Signum's ColorPaletteLogic).
        // Before OperationLogic.start so its operation symbols get seeded.
        ColorPaletteLogic.start(sb);

        // Dashboards module (altea-dashboard): the Dashboard entity + its Save/Delete/Clone operations, the
        // dashboard cache, XML import/export and the lookup routes (Signum's DashboardLogic.Start). AFTER
        // UserQueriesLogic / UserChartLogic so their part types are registered in the dashboard part registry
        // before a dashboard is imported, and before OperationLogic.start so its operation symbols get seeded.
        DashboardLogic.start(sb);
        DashboardLogic.registerUserTypeCondition(EastwindTypeCondition.UserEntities);
        DashboardLogic.registerRoleTypeCondition(EastwindTypeCondition.RoleEntities);

        // Toolbar module (altea-toolbar): the Toolbar / ToolbarMenu / ToolbarSwitcher entities + their
        // Save/Delete operations and queries, the toolbar caches, XML import/export and the
        // /api/toolbar/* routes (Signum's ToolbarLogic.Start). AFTER UserQueriesLogic / UserChartLogic /
        // DashboardLogic so their CONTENT CONFIGS are registered before a toolbar response is ever built,
        // and before OperationLogic.start so its operation symbols get seeded.
        ToolbarLogic.start(sb);
        // Row-level owner scoping, exactly as for the other user assets (Southwind's
        // ToolbarLogic.RegisterUser/RoleTypeCondition): a role whose Toolbar rule uses these conditions sees
        // only its own + the shared/global toolbars.
        ToolbarLogic.registerUserTypeCondition(EastwindTypeCondition.UserEntities);
        ToolbarLogic.registerRoleTypeCondition(EastwindTypeCondition.RoleEntities);
        // Tour module (altea-tour): the Tour entity + its steps, the TourTrigger symbol table, the
        // by-trigger lazy the tour button reads, and the XML (de)serializer. AFTER DashboardLogic and
        // UserQueriesLogic: a tour's trigger is @implementedBy(Type, TourTrigger, Dashboard, UserQuery),
        // and this module hangs its "drop stale steps" cascades off those two types' schema events.
        TourLogic.start(sb);

        // Eval module (@altea/altea-eval): the ViewDynamicPanel permission, the eval-errors endpoint, and —
        // the part that matters — the COMPILER configuration plus the registry of what a stored script may
        // import (see eastwindEval.server.ts, the counterpart of Signum's EvalLogic.AddFullAssembly block).
        // BEFORE every module whose entities carry an EvalEmbedded: an e-mail / Office template's
        // `applicable`, and the workflow's eight.
        EastwindEval.start(sb);

        // Email + templating modules (altea-email / altea-templating): the EmailMessage / EmailTemplate /
        // EmailMasterTemplate / EmailSenderConfiguration tables, the template parser's symbol tables, the
        // async sender's routes, and the "send this template" lookups (Signum's EmailLogic.Start). AFTER
        // FileLogic (attachments are FilePathEmbeddeds in a real store) and after the auth logics so
        // ViewAsyncEmailSenderPanel lands in the same permission seed; BEFORE OperationLogic.start so its
        // operation symbols get seeded.
        //
        // The app supplies only what is app-specific — Signum's `EmailLogic.Start(sb, () => Configuration
        // .Value.Email, (template, target, message) => Configuration.Value.EmailSender)`: the two members of
        // the configuration row, and where attachments are stored. The USER email owner and the default
        // master template are the MODULES' (altea-email registers both — see EmailLogic.start).
        FileTypeLogic.register(EmailFileType.Attachment,
            EastwindFileStores.store("email-attachments"));
        // Self-service password reset (@altea/altea-auth-reset-password): the ResetPasswordRequest table, the
        // two e-mail models and the three ANONYMOUS /api/auth/* routes (Southwind's
        // `ResetPasswordRequestLogic.Start(sb)`). BEFORE EmailLogic.start, because its e-mail models have to
        // be in the registry when the EmailModel table is seeded / synchronized.
        ResetPasswordRequestLogic.start(sb);

        EmailLogic.start(sb, {
            getConfiguration: () => GlobalsLogic.configuration().email,
            // Signum's `(template, target, message) => Configuration.Value.EmailSender` — the row names it.
            getSenderConfiguration: async () => GlobalsLogic.configuration().emailSender,
        });

        // The BATCH half of the mail module (Signum.Mailing/Package): the EmailPackage table, the two
        // process algorithms and the ReSendEmails operation. After EmailLogic.start (it reads the same
        // configuration) and after CacheLogic/ProcessLogic, whose registry it registers into.
        EmailPackageLogic.start(sb);

        // The scheduled task that sends a template to nothing / one target / every row of a user query
        // (Signum.Mailing/Package/SendEmailTaskLogic). After EmailPackageLogic — its UserQuery branch
        // queues a package through it — and after SchedulerLogic, whose task registry it registers into.
        SendEmailTaskLogic.start(sb);

        // The two extra SENDER services (@altea/altea-mailing-exchange, -microsoft-graph). Each contributes
        // one service TABLE and registers itself in EmailLogic's sender registry; which one a message actually
        // goes through is decided per EmailSenderConfiguration row, so starting both costs nothing until one
        // is configured. Both re-check that entityOverrides widened EmailSenderConfiguration.service, and fail
        // loudly here rather than at the first send.
        MailingExchangeWSLogic.start(sb);
        MailingMicrosoftGraphLogic.start(sb);

        // The INBOUND half (altea-email's reception module + @altea/altea-mailing-pop3): the
        // EmailReceptionConfiguration / EmailReception tables, the ReceiveEmails operation, and the two ways a
        // poll is triggered (a ScheduledTask on one configuration, or the sweep SimpleTask over every active
        // one). AFTER EmailLogic.start (it needs the EmailMessage table and the attachment store) and BEFORE
        // OperationLogic.start so its operation symbols get seeded.
        //
        // Its sweep SimpleTask is registered here, AFTER SchedulerLogic.start — which is fine: SymbolLogic
        // reads the declared-symbol list through a THUNK, evaluated when the table is generated /
        // synchronized / loaded, all of which happen after every module's start() has run.
        Pop3ConfigurationLogic.start(sb);
        EmailReceptionLogic.start(sb);

        // Browsing a user's real Outlook mailbox (@altea/altea-mailing-microsoft-graph's RemoteEmails half).
        // OPT-IN: it registers a search page whose every row is a live Microsoft Graph call, so without an
        // Entra tenant configured it would only ever show an error. EASTWIND_REMOTE_EMAILS=true enables it.
        if (process.env["EASTWIND_REMOTE_EMAILS"] === "true")
            RemoteEmailsLogic.start(sb);

        // Alerts module (@altea/altea-alert): the Alert table + the AlertTypeSymbol table, the two endpoints
        // the navbar bell polls and the WebSocket hub that pushes "your alerts changed". AFTER the auth logics
        // (an alert is addressed to a USER) and BEFORE OperationLogic.start so its six operation symbols get
        // seeded. `registerExpressionsFor` is Southwind's `AlertLogic.Start(sb, typeof(UserEntity),
        // typeof(OrderEntity))`: those two types grow the `Alerts` / `MyActiveAlerts` sub-tokens.
        AlertLogic.start(sb, { registerExpressionsFor: [UserEntity, OrderEntity as unknown as Type<Entity>] });

        // Free-text notes on any entity (Signum.Notes). Southwind starts it with the same two types the
        // alerts get, so a note is offered where an alert is.
        NoteLogic.start(sb, { registerExpressionsFor: [UserEntity, OrderEntity as unknown as Type<Entity>] });

        // …and its OPT-IN notification half (Signum's RegisterAlertNotificationMail): the e-mail model and
        // the ScheduledTask that mails each user their pending alerts. AFTER EmailLogic.start (it registers an
        // email model) and after SchedulerLogic.start (it registers a task type).
        AlertNotificationLogic.start(sb);

        // Office-template module (altea-office-template): the OfficeTemplate / OfficeModel tables, the
        // OfficeTransformerSymbol / OfficeConverterSymbol symbol tables, the GenerateReport permission, and
        // the three routes (createReport / constructorType / officeTemplates). AFTER altea-email, because
        // an OfficeAttachment hangs off an EmailTemplate; BEFORE OperationLogic.start so its three
        // operations are in the registry when the OperationSymbol table is seeded.
        OfficeTemplateLogic.start(sb);

        // Excel export (altea-office-template's Signum.Excel half): declares no tables — its PlainExcel
        // permission symbol rides along in the PermissionSymbol seed — and mounts POST /api/excel/plain/
        // :queryKey, which turns any query request into an .xlsx download. Its own starter, separate from
        // the importer's (below), so an app can offer export without import.
        PlainExcelLogic.start(sb);

        // Excel import (the other half of the Signum.Excel port, its own starter): mounts POST
        // /api/excel/validateForImport/:queryKey + /api/excel/import/:queryKey, which read an .xlsx back
        // into entities through a chosen operation. Its ImportFromExcel permission rides the same seed.
        ExcelImportLogic.start(sb);

        // Migrations module (altea-migrations): the SqlMigration / CSharpMigration history tables + the
        // LoadMethodLog every terminal load step writes. Server-only (the runners live in the terminal), and
        // the tables must be part of the schema for `sync` / the load menu to log into them.
        MigrationLogic.start(sb);

        // Dynamic module (altea-dynamic): the three VIEW tables (a view defined in the database, a
        // selector that picks between them, an override that rewrites an existing view), the CSS-override
        // table + its anonymous endpoint, and the SQL-migration table. Before OperationLogic.start so its
        // operation symbols get seeded. The COMPILED half of Signum.Dynamic (dynamic types / expressions /
        // validations / api / type conditions) is not ported — see the module's DynamicLogic header.
        DynamicLogic.start(sb);

        // Workflow module (@altea/altea-workflow): the BPMN engine — workflows / pools / lanes / nodes /
        // connections, cases, case activities + notifications, the scheduled-start tasks and the script
        // runner. AFTER the scheduler (its timeout sweep is a SimpleTask), processes (the timeout process
        // algorithm) and auth (a lane's actors are users/roles), and before OperationLogic.start so its many
        // operation symbols get seeded. eastwind then makes ORDER a case main entity and registers the app's
        // Southwind starts the module but declares no main entity, so nothing could actually run through it
        // (see orders/OrderWorkflow.server.ts). Its conditions / actions / scripts are stored TypeScript compiled
        // by the eval module above.
        WorkflowLogicStarter.start(sb, () => GlobalsLogic.configuration().workflow);
        OrderWorkflow.registerOrderAsMainEntity(sb);

        // Omnibox module (altea-omnibox): declares no tables (its ViewOmnibox permission symbol is seeded
        // through the PermissionSymbol table above); registers the entity / dynamic-query / special result
        // generators and mounts POST /api/omnibox. LAST of the module starts so its generators see every
        // registered query — the query REGISTRY is read per request, but keeping it last matches Signum's
        // OmniboxLogic.Start position and avoids any ordering surprise.
        OmniboxLogic.start(sb);

        // Schema / operation map (@altea/altea-map): owns no tables — both pages are derived from the live
        // Schema, the operation registry and the database's own catalog views. AFTER OmniboxLogic.start,
        // because it pushes a generator onto `OmniboxParser.generators` (the array is read per request, so
        // the order is only for readability — the same reason Southwind starts MapLogic after Omnibox).
        MapLogic.start(sb);

        // In-app documentation (@altea/altea-help): the four help tables + their operations, the reflection
        // prose generator, the pages, the search and the zip import/export. AFTER OmniboxLogic.start (it
        // pushes a generator) and BEFORE OperationLogic.start so its eight operation symbols get seeded.
        // The image store is the app's, exactly as Southwind's `GetFileTypeAlgorithm(p => p.HelpImagesFolder)`.
        HelpModuleLogic.start(sb, EastwindFileStores.store("help-images", { onlyImages: true }));

        // Tree module (@altea/altea-tree): the UserTreePart dashboard part, the three endpoints the tree
        // viewer reads, and the omnibox suggestion. Owns no tree TYPE — the app's is DepartmentEntity,
        // registered below. AFTER OmniboxLogic.start (it pushes a generator) and BEFORE
        // OperationLogic.start, so the seven operation symbols `withTree` registers get seeded.
        TreeModuleLogic.start(sb);
        DepartmentsLogic.start(sb);

        // Rest module (@altea/altea-rest): the API-key table + its authenticator, and the replayable log
        // of every request that reached the app's public REST surface. BEFORE OperationLogic.start so the
        // key's Save/Delete symbols get seeded. Southwind starts the two halves as two calls
        // (`RestLogLogic.Start` / `RestApiKeyLogic.Start`); altea packages expose one start per module.
        RestModuleLogic.start(sb);

        // ViewLog module (@altea/altea-view-log): one row per "the API handed this entity out" and per
        // "a search ran", with the SQL the search executed. `registerExpressionsFor` is Southwind's exact
        // set — the three user assets whose search pages get the "who looked at this?" sub-tokens.
        // BEFORE OperationLogic.start, like every other include; the two subscriptions it installs are
        // core seams (ExecutionMode.onApiRetrieved / QueryLogic.queries.queryExecuted), so nothing else
        // needs to know it is here.
        // SMS module (@altea/altea-sms): the message + template tables, the send / update-status processes
        // and the scheduled status refresh. `provider` is deliberately UNSET — Signum ships no gateway
        // either and Southwind passes null, so a message can be authored and packaged but sending answers
        // "No ISMSProvider set" until an app supplies one. BEFORE OperationLogic.start, so its eight
        // operation symbols get seeded.
        SMSModuleLogic.start(sb, { getConfiguration: () => GlobalsLogic.configuration().sms });

        // eastwind's SMS owner: a CUSTOMER (Northwind's customers carry a phone). This is what earns
        // Person / Company the `SMSMessages` sub-token, the "SMS messages" quick link, and the
        // "send this text to all of these" contextual operation — Southwind registers none, so without it
        // the module would have nothing to be about.
        // The `SMSMessages` sub-token is registered PER CONCRETE TYPE (altea keys an extension token on a
        // constructor — see the module's registerSMSOwner note)…
        SMSLogic.registerSMSOwner(PersonEntity);
        SMSLogic.registerSMSOwner(CompanyEntity);
        // …but the "send to all of these" OPERATION is registered ONCE, on the abstract base: an operation
        // is keyed by its symbol, and a subclass inherits its base's (OperationLogic.operationsForType walks
        // the prototype chain — see CLAUDE.md). Signum registers it per concrete type only because C#
        // generics force `Graph<ProcessEntity>.ConstructFromMany<T>` to name one.
        SMSProcessLogic.registerSMSOwnerData(CustomerEntity, c => ({
            owner: c.toLite(), telephoneNumber: c.phone, culture: null,
        }));

        // Print queue (@altea/altea-printing): the PrintLine / PrintPackage tables, the line's state
        // machine, the batch process and the "reclaim printed files" scheduled task. AFTER
        // SchedulerLogic.start (it registers a SimpleTask) and BEFORE OperationLogic.start (five operation
        // symbols to seed).
        //
        // `PrintingLogic.print` is deliberately UNSET — its default throws "PrintingLogic.print is not
        // defined", exactly as Signum's does, because what "print" means (a spooler, a network printer, an
        // SDK) is an app decision and eastwind has no printer. The same call the SMS `provider` gets above.
        // The TEST file type IS supplied, so `PrintLineOperation.CreateTest` has somewhere to upload:
        // Southwind passes none, which leaves that flow with nowhere to go.
        PrintingLogic.start(sb, { testFileType: EastwindFileType.PrintTest });
        FileTypeLogic.register(EastwindFileType.PrintTest,
            EastwindFileStores.store("print-test"));
        if (sb.webBuilder)
            PrintingServer.start(sb.webBuilder);

        // Release notes (@altea/altea-whats-new): the news item + its per-culture messages, the read log,
        // and the six routes the navbar bullhorn / overview / news page call. BEFORE OperationLogic.start
        // (five operation symbols to seed).
        //
        // The two FILE TYPES are the module's own; eastwind points both at one folder, as Southwind does
        // for its own two. The PUBLISHED type condition is granted to ordinary users below, next to the
        // other type-condition rules: without it a non-admin sees no news at all, since the row filter is
        // what makes a Draft invisible.
        WhatsNewLogic.start(sb);
        FileTypeLogic.register(WhatsNewFileType.WhatsNewPreviewFileType,
            EastwindFileStores.store("whats-new"));
        FileTypeLogic.register(WhatsNewFileType.WhatsNewAttachmentFileType,
            EastwindFileStores.store("whats-new"));
        WhatsNewLogic.registerPublishedTypeCondition(EastwindTypeCondition.PublishedNews);
        if (sb.webBuilder)
            WhatsNewServer.start(sb.webBuilder);

        ViewLogLogic.start(sb, {
            registerExpressionsFor: [
                UserQueryEntity as unknown as Type<Entity>,
                UserChartEntity as unknown as Type<Entity>,
                DashboardEntity as unknown as Type<Entity>,
            ],
        });
        // Translations module (altea-translations): both halves — the pages that edit each PACKAGE's own
        // translations/*.xml files (the code half, nothing stored), and the TranslatedInstance table +
        // its pages (the instance half, for every @translatable route). BEFORE OperationLogic.start so
        // its Save/Delete symbols get seeded; the default translator chain is the offline
        // "already translated elsewhere" one, so no API key is needed.
        TranslationLogic.start(sb);

        // Framework operation infrastructure (Signum's OperationLogic.Start): the OperationSymbol table
        // (seeded with the operations the modules above registered) + the OperationLogEntity table/query
        // that backs the operation-log quick link. Must run AFTER the module graphs register.
        OperationLogic.start(sb);

        // DiffLog module (altea-diff-log): the surround-operation handler that dumps the entity before and
        // after every operation onto the operation log's DiffLogMixin (declared in entityOverrides, which is
        // what puts those columns in the schema), plus the two navigation routes the OperationLog view reads.
        // AFTER OperationLogic.start, whose OperationLogEntity table it decorates. `registerAll` is
        // Southwind's setting: dump EVERY entity type, not an opt-in list.
        DiffLogLogic.start(sb, { registerAll: true });

        // TimeMachine module (altea-time-machine): the ShowTimeMachine permission plus the route the
        // version page reads. It needs nothing else — what it browses is the HISTORY of the tables marked
        // @systemVersioned (eastwind: OrderEntity, exactly as Southwind marks it), and the
        // `PreviousOperationLog` column it shows is registered by OperationLogic above — which is why
        // this call comes AFTER it.
        TimeMachineLogic.start(sb);

        // The app's own GLOBALS (Southwind's Globals/GlobalsLogic.cs): the ApplicationConfiguration table
        // every module's configuration lambda above reads through GlobalsLogic.configuration(). LAST, exactly
        // where Southwind calls it: the row REFERENCES an EmailSenderConfiguration and embeds each module's
        // configuration type, so those includes must already exist. Nothing above it evaluates a lambda —
        // they are all read after the warm-up below.
        GlobalsLogic.start(sb);

        // Expose a search query for the TypeEntity system table (Signum ships one). It's included by the
        // schema core but never `.withQuery()`'d, so `/find/Type` reported "not allowed"; register it here.
        // (Scoped to eastwind rather than the framework to avoid re-seeding altea-test's query table.)
        sb.include(TypeEntity as unknown as Type<Entity>).withQuery();

        sb.complete();

        // Signum's Schema.Initialize(): read the persisted TypeEntity ids back into the type↔id caches
        // (internally TypeLogic.load). Tolerant of a not-yet-generated database (the `new`/`create`
        // terminal command runs against an empty DB); the deterministic bootstrap then covers reads until
        // generation seeds the table. `create`/`sync` re-initialize afterwards (see terminal.ts).
        await sb.schema.initialize();

        // Load translations: each installed module's own `translations/` directory (walked from this
        // app's dependency graph), then the app's own `<cwd>/translations` last so it wins a collision.
        loadAppTranslations();

        // Warm the culture cache into its sync snapshot: the reflection endpoint answers the culture
        // catalogue on every client boot and cannot await a query there. Tolerant of a not-yet-generated
        // database, like schema.initialize above.
        try { await CultureInfoLogic.warmUp(); } catch { /* table not created yet — the seeder fills it */ }

        // Load THIS environment's ApplicationConfiguration into its sync snapshot (Signum reads its
        // `Starter.Configuration` lazy on first use; altea's ResetLazy is async and every module's
        // configuration getter is not — see GlobalsLogic). Tolerant of a not-yet-generated or not-yet-seeded
        // database, like the culture warm-up above: a module that then asks for its configuration fails with
        // GlobalsLogic's message naming the migration, rather than silently running on defaults.
        try { await GlobalsLogic.warmUp(); } catch (e) { console.warn(`[globals] ${(e as Error).message}`); }

        // The app's own PUBLIC REST surface (Southwind's Public/CatalogAPIController) — what an API key
        // authenticates against and what @altea/altea-rest logs. After every module, so its RestLog
        // middleware sits behind the auth middleware AuthLogic.start installed.
        if (sb.webBuilder) {
            CatalogApi.start(sb.webBuilder);
            // The ANONYMOUS catalog the public landing page reads (Southwind's Public/CatalogController).
            // Its property routes resolve through the reflection metadata, so it must come after the
            // entity modules — as it does here.
            PublicCatalogApi.start(sb.webBuilder);
        }

        // The three BACKGROUND RUNNERS (Southwind.Server/Program.cs's `StartBackgroundProcesses` block).
        // eastwind had never started them: a scheduled task, a queued process and an async e-mail were all
        // created but nothing ever ran them — the SMS module's Send / UpdateStatus processes are what
        // surfaced it. Like Southwind, they start a few seconds AFTER the schema is up (so the first pump
        // does not race initialization) and only with a WEB host: a terminal run must not pick work up.
        if (sb.webBuilder) {
            ProcessRunner.startRunningProcessesAfter(5000);
            ScheduleTaskRunner.startScheduledTasksAfter(5000);
            AsyncEmailSender.startAsyncEmailSenderAfter(5000);
        }

        // Mount the framework HTTP API last (Signum's SignumServer.Start): after the modules' own routes
        // (registered by their Logic.start above) so the auth middleware/gate run first, and so the JSON
        // exception filter — Express error middleware, registered inside SignumServer.start — is truly last.
        if (sb.webBuilder)
            SignumServer.start(sb.webBuilder);
    }
}

// A boolean read off the environment. Accepts "true" / "1" in any casing, so a value typed into a .env
// file by hand does what it looks like it does; anything else (including unset) is false.
function isEnvTrue(value: string | undefined): boolean {
    const v = value?.trim().toLowerCase();
    return v === "true" || v === "1";
}
