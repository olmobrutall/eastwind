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
import { CustomersLogic } from "./customers/CustomerLogic.server";
import { OrdersLogic } from "./orders/OrderLogic.server";
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
import { EastwindTask } from "./eastwindTasks.server";
import { ProcessLogic } from "@altea/altea-processes/server/ProcessLogic.server";
import { ProcessSchedulerBridge } from "@altea/altea-processes/server/ProcessSchedulerBridge.server";
import { EastwindProcess } from "./eastwindProcesses.server";
import { OmniboxLogic } from "@altea/altea-omnibox/server/OmniboxLogic";
import { DiffLogLogic } from "@altea/altea-diff-log/server/DiffLogLogic";
import { WorkflowLogicStarter } from "@altea/altea-workflow/server/WorkflowLogicStarter.server";
import { EastwindWorkflow } from "./eastwindWorkflow.server";
import { DynamicLogic } from "@altea/altea-dynamic/server/DynamicLogic.server";
import { EmailLogic } from "@altea/altea-email/server/EmailLogic.server";
import { FileTypeLogic } from "@altea/altea-files/server/FileTypeLogic.server";
import { FileTypeAlgorithm } from "@altea/altea-files/server/FileTypeAlgorithm.server";
import { EastwindFileStores } from "./eastwindFileStores.server";
import { EmailReceptionLogic } from "@altea/altea-email/server/EmailReceptionLogic.server";
import { MailingExchangeWSLogic } from "@altea/altea-mailing-exchange/server/MailingExchangeWSLogic";
import { MailingMicrosoftGraphLogic } from "@altea/altea-mailing-microsoft-graph/server/MailingMicrosoftGraphLogic";
import { RemoteEmailsLogic } from "@altea/altea-mailing-microsoft-graph/server/RemoteEmailsLogic";
import { Pop3ConfigurationLogic } from "@altea/altea-mailing-pop3/server/Pop3ConfigurationLogic";
import { EmailFileType } from "@altea/altea-email/data/Email";
import { EastwindEmail } from "./eastwindEmail.server";
import { OfficeTemplateLogic } from "@altea/altea-office-template/server/OfficeTemplateLogic.server";
import { ToolbarLogic } from "@altea/altea-toolbar/server/ToolbarLogic.server";
import { PlainExcelLogic } from "@altea/altea-office-template/server/excel/PlainExcelLogic.server";
import { ExcelImportLogic } from "@altea/altea-office-template/server/excel/ExcelImportLogic.server";
import { MigrationLogic } from "@altea/altea-migrations/server/MigrationLogic.server";
import { EastwindTypeCondition } from "./eastwindTypeConditions.data";
import { CacheLogic } from "@altea/altea-cache/server/CacheLogic";
import { ConcurrentUserLogic } from "@altea/altea-concurrent-user/server/ConcurrentUserLogic.server";
import { ChatbotLogic } from "@altea/altea-agent/server/ChatbotLogic";
import { AgentLogic } from "@altea/altea-agent/server/AgentLogic";
import { AgentMcpServer } from "@altea/altea-agent/server/AgentMcpServer";
import { ChatbotServer } from "@altea/altea-agent/server/ChatbotServer";
import { EastwindAgent } from "./eastwindAgent.server";
import { EastwindAgentUseCases } from "./eastwindAgents.data";
import { AzureADLogic } from "@altea/altea-auth-azuread/server/AzureADLogic";
import { CachedProfilePhotoLogic } from "@altea/altea-auth-azuread/server/CachedProfilePhotoLogic";
import { OpenIDLogic } from "@altea/altea-auth-openid/server/OpenIDLogic";
import { WindowsADLogic } from "@altea/altea-auth-windowsad/server/WindowsADLogic";
import { ResetPasswordRequestLogic } from "@altea/altea-auth-reset-password/server/ResetPasswordRequestLogic";
import { EastwindAuthAD } from "./eastwindAuthAD.server";
import { CacheServer } from "@altea/altea-cache/server/CacheServer";
import { PostgresBroadcast } from "@altea/altea-cache/server/Broadcast/PostgresBroadcast";

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

        // Cache module (altea-cache) — FIRST of all the module starts, for two reasons: it swaps the
        // global-lazy invalidation strategy (which must happen before ANY `sb.globalLazy` registration),
        // and `.withCache()` on an include below needs it started. The broadcast is what tells SIBLING
        // processes to invalidate; on Postgres that is LISTEN/NOTIFY, which needs no configuration
        // (Signum's `PostgresBroadcast`). A single-process host works fine without one — every write goes
        // through this process, so its own events cover it.
        CacheLogic.start(sb, { serverBroadcast: connector.isPostgres ? new PostgresBroadcast() : undefined });

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
        AuthLogic.start(sb);
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
        // Which BACKEND holds the bytes is one env var away (EASTWIND_FILE_STORE=folder|azure|s3) — see
        // eastwindFileStores.server.ts. `onlyImages` is what makes an Azure / S3 store serve these INLINE.
        CachedProfilePhotoLogic.start(sb, EastwindFileStores.store("profilePhotos", { onlyImages: true }));

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
        // the in-process runner's routes. The simple tasks are REGISTERED FIRST because the symbol table is
        // seeded from the registered keys (SimpleTaskLogic.start reads them). After the auth logics so
        // ViewSchedulerPanel lands in the same permission seed, and after FileLogic for the same
        // route-ordering reason.
        EastwindTask.register();
        SchedulerLogic.start(sb);

        // Processes module (altea-processes): the Process / Package tables and the in-process runner's
        // routes. Algorithms are REGISTERED FIRST (the ProcessAlgorithmSymbol table is seeded from their
        // keys), and the SCHEDULER BRIDGE goes last: it makes a ProcessAlgorithmSymbol a valid
        // ScheduledTask.task, so a scheduled entry creates + queues a process instead of running inline.
        // (The matching implementedBy widening is declared in entityOverrides.data.ts — both tiers need it.)
        EastwindProcess.register();
        ProcessLogic.start(sb);
        ProcessSchedulerBridge.start(sb);

        // Agent module (@altea/altea-agent): the chat tables + language-model registry (ChatbotLogic) and the
        // agent / skill registry (AgentLogic). Order matters three ways: the skill CLASSES are registered
        // first (the SkillCode table is seeded from them and `registerAgent` asserts against it), the
        // chatbot's own agent is handed to AgentLogic.start so DefaultAgent.Chatbot resolves, and the app's
        // extra MCP agent is registered after — before OperationLogic.start, so its symbols get seeded.
        // AFTER the chart module: the ChartSkill reads ChartScriptLogic's registered scripts.
        EastwindAgent.setUrlLeft(EastwindEmail.configuration().urlLeft);
        EastwindAgent.registerSkills();
        ChatbotLogic.start(sb, EastwindAgent.configuration);
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

        // Email + templating modules (altea-email / altea-templating): the EmailMessage / EmailTemplate /
        // EmailMasterTemplate / EmailSenderConfiguration tables, the template parser's symbol tables, the
        // async sender's routes, and the "send this template" lookups (Signum's EmailLogic.Start). AFTER
        // FileLogic (attachments are FilePathEmbeddeds in a real store) and after the auth logics so
        // ViewAsyncEmailSenderPanel lands in the same permission seed; BEFORE OperationLogic.start so its
        // operation symbols get seeded.
        //
        // The app supplies three things (see eastwindEmail.server.ts): the configuration, which sender
        // configuration to use, and how to read an email owner's address. The default MASTER TEMPLATE and the
        // email OWNERS are registered first, since EmailLogic.start's model seeding may already need them.
        EastwindEmail.registerEmailOwners();
        EastwindEmail.registerDefaultMasterTemplate();
        FileTypeLogic.register(EmailFileType.Attachment, EastwindFileStores.store("emailAttachments"));
        // Self-service password reset (@altea/altea-auth-reset-password): the ResetPasswordRequest table, the
        // two e-mail models and the three ANONYMOUS /api/auth/* routes (Southwind's
        // `ResetPasswordRequestLogic.Start(sb)`). BEFORE EmailLogic.start, because its e-mail models have to
        // be in the registry when the EmailModel table is seeded / synchronized.
        ResetPasswordRequestLogic.start(sb);

        EmailLogic.start(sb, {
            getConfiguration: () => EastwindEmail.configuration(),
            getSenderConfiguration: EastwindEmail.senderConfiguration,
        });

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
        // condition / action / lane-actor hooks — Southwind starts the module but declares no main entity, so
        // nothing could actually run through it (see eastwindWorkflow.server.ts).
        WorkflowLogicStarter.start(sb, EastwindWorkflow.configuration);
        EastwindWorkflow.registerOrderAsMainEntity(sb);
        EastwindWorkflow.registerEvaluators();

        // Omnibox module (altea-omnibox): declares no tables (its ViewOmnibox permission symbol is seeded
        // through the PermissionSymbol table above); registers the entity / dynamic-query / special result
        // generators and mounts POST /api/omnibox. LAST of the module starts so its generators see every
        // registered query — the query REGISTRY is read per request, but keeping it last matches Signum's
        // OmniboxLogic.Start position and avoids any ordering surprise.
        OmniboxLogic.start(sb);

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

        // Load translations from the app's single translations directory (TRANSLATIONS_ROOT/env or
        // <cwd>/translations). Every module's `<Module>.<culture>.xml` lives there (Signum's model).
        loadAppTranslations();

        // Warm the culture cache into its sync snapshot: the reflection endpoint answers the culture
        // catalogue on every client boot and cannot await a query there. Tolerant of a not-yet-generated
        // database, like schema.initialize above.
        try { await CultureInfoLogic.warmUp(); } catch { /* table not created yet — the seeder fills it */ }

        // Resolve EASTWIND_AD_DEFAULT_ROLE (a role NAME) into the directory modules' `defaultRole`. After
        // schema.initialize because it reads the Role table, and the configuration getters are synchronous.
        await EastwindAuthAD.resolveDefaultRoleFromEnv();

        // Mount the framework HTTP API last (Signum's SignumServer.Start): after the modules' own routes
        // (registered by their Logic.start above) so the auth middleware/gate run first, and so the JSON
        // exception filter — Express error middleware, registered inside SignumServer.start — is truly last.
        if (sb.webBuilder)
            SignumServer.start(sb.webBuilder);
    }
}
