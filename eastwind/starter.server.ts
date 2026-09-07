import "@altea/altea/server/context.node"; // register server context storage first
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // sb.include(...).withQuery()
import { Connector } from "@altea/altea/server/connection/connector";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { TypeEntity } from "@altea/altea/data/typeEntity";
import type { Entity, Type } from "@altea/altea/data/entity";
import { SignumServer } from "@altea/altea/server/signumServer";
import type { WebBuilder } from "@altea/altea/server/webApi";
import { ExceptionLogic } from "@altea/altea/server/exceptionLogic";
import { SystemEventLogLogic } from "@altea/altea/server/systemEventLogLogic";
import { CultureInfoLogic } from "@altea/altea/server/cultureInfoLogic";
import { OperationLogic } from "@altea/altea/server/operationLogic";
import { loadAppTranslations } from "@altea/altea/server/translations";
import { simplifyDiffTables, simplifyDiffEnums } from "@altea/altea/server/sync/schemaSynchronizer";
import { EntityOverrides } from "./entityOverrides.data";
import { EmployeesLogic } from "./employees/EmployeeLogic.server";
import { ProductsLogic } from "./products/ProductLogic.server";
import { ShippersLogic } from "./shippers/ShipperLogic.server";
import { DepartmentsLogic } from "./departments/DepartmentLogic.server";
import { CustomersLogic } from "./customers/CustomerLogic.server";
import { OrdersLogic } from "./orders/OrderLogic.server";
import { OrderEntity } from "./orders/Order.data";
import { ProductPredictorPublication } from "./products/Product.data";
import { EmployeeEntity } from "./employees/Employee.data";
import { CustomerEntity, PersonEntity, CompanyEntity } from "./customers/Customer.data";
import { AuthLogic } from "@altea/altea-auth/server/AuthLogic";
import { TypeAuthLogic } from "@altea/altea-auth/server/TypeAuthLogic";
import { PermissionAuthLogic } from "@altea/altea-auth/server/PermissionAuthLogic";
import { OperationAuthLogic } from "@altea/altea-auth/server/OperationAuthLogic";
import { QueryAuthLogic } from "@altea/altea-auth/server/QueryAuthLogic";
import { PropertyAuthLogic } from "@altea/altea-auth/server/PropertyAuthLogic";
import { UserTicketLogic } from "@altea/altea-auth/server/UserTicketLogic";
import { SessionLogLogic } from "@altea/altea-auth/server/SessionLogLogic";
import { TypeConditionLogic } from "@altea/altea-auth/server/TypeConditionLogic";
import { UserEntity } from "@altea/altea-auth/data/User";
import { UserHolder } from "@altea/altea/server/userHolder";
import { ProfilerLogic } from "@altea/altea-profiler/server/ProfilerLogic";
import { UserQueriesLogic } from "@altea/altea-user-queries/server/UserQueriesLogic";
import { ChartLogic } from "@altea/altea-chart/server/ChartLogic";
import { ColorPaletteLogic } from "@altea/altea-chart/server/ColorPaletteLogic";
import { UserChartLogic } from "@altea/altea-chart/server/UserChartLogic";
import { DashboardLogic } from "@altea/altea-dashboard/server/DashboardLogic";
import { CachedQueryLogic } from "@altea/altea-dashboard/server/CachedQueryLogic";
import { FileLogic } from "@altea/altea-files/server/FileLogic";
import { SchedulerLogic } from "@altea/altea-scheduler/server/SchedulerLogic";
import { SimpleTaskLogic } from "@altea/altea-scheduler/server/SimpleTaskLogic";
import { ScheduleTaskRunner } from "@altea/altea-scheduler/server/ScheduleTaskRunner";
import { ProcessRunner } from "@altea/altea-processes/server/ProcessRunner";
import { AsyncEmailSender } from "@altea/altea-email/server/AsyncEmailSender";
import { ProcessLogic } from "@altea/altea-processes/server/ProcessLogic";
import { PackageLogic } from "@altea/altea-processes/server/PackageLogic";
import { ProcessSchedulerBridge } from "@altea/altea-processes/server/ProcessSchedulerBridge";
import { OmniboxLogic } from "@altea/altea-omnibox/server/OmniboxLogic";
import { MapLogic } from "@altea/altea-map/server/MapLogic";
import { HelpModuleLogic } from "@altea/altea-help/server/HelpModuleLogic";
import { DiffLogLogic } from "@altea/altea-diff-log/server/DiffLogLogic";
import { TimeMachineLogic } from "@altea/altea-time-machine/server/TimeMachineLogic";
import { TreeModuleLogic } from "@altea/altea-tree/server/TreeModuleLogic";
import { RestModuleLogic } from "@altea/altea-rest/server/RestModuleLogic";
import { ViewLogLogic } from "@altea/altea-view-log/server/ViewLogLogic";
import { SMSModuleLogic } from "@altea/altea-sms/server/SMSModuleLogic";
import { SMSLogic } from "@altea/altea-sms/server/SMSLogic";
import { SMSProcessLogic } from "@altea/altea-sms/server/SMSProcessLogic";
import { UserQueryEntity } from "@altea/altea-user-queries/data/UserQuery";
import { UserChartEntity } from "@altea/altea-chart/data/UserChart";
import { DashboardEntity } from "@altea/altea-dashboard/data/Dashboard";
import { CatalogApi } from "./publicApi/CatalogApi.server";
import { PublicCatalogApi } from "./publicApi/PublicCatalog.server";
import { TourLogic } from "@altea/altea-tour/server/TourLogic";
import { TranslationLogic } from "@altea/altea-translations/server/TranslationLogic";
import { WorkflowLogicStarter } from "@altea/altea-workflow/server/WorkflowLogicStarter";
import { OrderWorkflow } from "./orders/OrderWorkflow.server";
import { EastwindEval } from "./eastwindEval.server";
import { DynamicLogic } from "@altea/altea-dynamic/server/DynamicLogic";
import { DynamicCodeCompiler } from "@altea/altea-dynamic/server/DynamicCodeCompiler";
import path from "node:path";
import { EmailLogic } from "@altea/altea-email/server/EmailLogic";
import { EmailPackageLogic } from "@altea/altea-email/server/EmailPackageLogic";
import { SendEmailTaskLogic } from "@altea/altea-email/server/SendEmailTaskLogic";
import { FileTypeLogic } from "@altea/altea-files/server/FileTypeLogic";
import type { FileTypeSymbol } from "@altea/altea-files/data/Files";
// The five types whose BigString text moves to a file — see configureBigString.
import { ExceptionEntity } from "@altea/altea/data/exception";
import { OperationLogEntity } from "@altea/altea/data/operationLog";
import { ViewLogEntity } from "@altea/altea-view-log/data/ViewLog";
import { EmailMessageEntity } from "@altea/altea-email/data/EmailMessage";
import { RestLogEntity } from "@altea/altea-rest/data/Rest";
import { FileTypeAlgorithm } from "@altea/altea-files/server/FileTypeAlgorithm";
import { EastwindFileStores } from "./eastwindFileStores.server";
import { BigStringLogic, BigStringConfiguration, type BigStringMode } from "@altea/altea-files/server/BigStringLogic";
import { EmailReceptionLogic } from "@altea/altea-email/server/EmailReceptionLogic";
import { MailingExchangeWSLogic } from "@altea/altea-mailing-exchange/server/MailingExchangeWSLogic";
import { MailingMicrosoftGraphLogic } from "@altea/altea-mailing-microsoft-graph/server/MailingMicrosoftGraphLogic";
import { RemoteEmailsLogic } from "@altea/altea-mailing-microsoft-graph/server/RemoteEmailsLogic";
import { Pop3ConfigurationLogic } from "@altea/altea-mailing-pop3/server/Pop3ConfigurationLogic";
import { EmailFileType } from "@altea/altea-email/data/Email";
import { OfficeTemplateLogic } from "@altea/altea-office-template/server/OfficeTemplateLogic";
import { ToolbarLogic } from "@altea/altea-toolbar/server/ToolbarLogic";
import { PlainExcelLogic } from "@altea/altea-office-template/server/excel/PlainExcelLogic";
import { ExcelImportLogic } from "@altea/altea-office-template/server/excel/ExcelImportLogic";
import { ExcelReportLogic } from "@altea/altea-office-template/server/excel/ExcelReportLogic";
import { MigrationLogic } from "@altea/altea-migrations/server/MigrationLogic";
import { SqlMigrationRunner } from "@altea/altea-migrations/server/SqlMigrationRunner";
import { TokenMigrationLogic } from "@altea/altea-user-assets/server/TokenMigrationLogic";
import { PredictorLogic } from "@altea/altea-machine-learning/server/PredictorLogic";
import { PredictorEntity_Filter, PredictorSubQueryEntity_Filter } from "@altea/altea-machine-learning/data/Predictor";
import { VisualTipLogic } from "@altea/altea/server/visualTipLogic";
import { ChangeLogLogic } from "@altea/altea/server/changeLogLogic";
import { ApplicationConfigurationEntity, EastwindTypeCondition, EastwindAgentUseCases, EastwindFileType, BigStringFileType } from "./globals/ApplicationConfiguration.data";
import { PrintingLogic } from "@altea/altea-printing/server/PrintingLogic";
import { PrintingServer } from "@altea/altea-printing/server/PrintingServer";
import { WhatsNewLogic } from "@altea/altea-whats-new/server/WhatsNewLogic";
import { WhatsNewServer } from "@altea/altea-whats-new/server/WhatsNewServer";
import { WhatsNewFileType } from "@altea/altea-whats-new/data/WhatsNew";
import { GlobalsLogic } from "./globals/GlobalsLogic.server";
import { CacheLogic } from "@altea/altea-cache/server/CacheLogic";
import { ConcurrentUserLogic } from "@altea/altea-concurrent-user/server/ConcurrentUserLogic";
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
import { AlertLogic } from "@altea/altea-alert/server/AlertLogic";
import { NoteLogic } from "@altea/altea-notes/server/NoteLogic";
import { AlertNotificationLogic } from "@altea/altea-alert/server/AlertNotificationLogic";
import { CacheServer } from "@altea/altea-cache/server/CacheServer";
import type { Schema } from "@altea/altea/server/schema";
import { EastwindModeServer } from "./eastwindMode.server";

// Port of Southwind's Starter.Start (Southwind/Starter.cs): the single global entry that builds the
// schema, binds the connector, registers each module's logic and completes. Extensions are excluded
// (eastwind → altea only). The dialect is chosen inline from the connection string, mirroring Signum's
// `isPostgres` branch: "postgres…" → PostgreSQL, otherwise SQL Server.
export namespace Starter {
    // `webBuilder` mirrors Signum's `sb.WebServerBuilder`: the web host passes the WebBuilder it created,
    // Starter sets it on the SchemaBuilder, and each module's `XxxLogic.start(sb)` mounts its own HTTP
    // surface via `if (sb.webBuilder) XxxServer.start(sb.webBuilder)`. A terminal / test omits it (no HTTP).
    /**
     * The built schema, kept so a host that DEFERRED initialization can run it later (see `initialize`).
     */
    let built: Schema | undefined;

    /**
     * Signum's `Schema.Current.Initialize()` — read the persisted ids and warm the caches that need the
     * database. Separate from `start` because WHEN it happens differs by host, exactly as in Signum: the web
     * host initializes at boot (Southwind.Server/Program.cs), while the TERMINAL does not — its menu appears
     * first and only the commands that read data initialize (Southwind.Terminal's `Load` and
     * `CSharpMigrations` call it; `Synchronize` and `NewDatabase` never do).
     *
     * That ordering is not cosmetic: every one of these caches reads a schema that `sync` exists to repair,
     * so initializing before the command is chosen means a wall of mismatch warnings and a pile of pointless
     * queries in front of the very command that would fix them.
     *
     * Idempotent — `schema.initialize()` is, and the two warm-ups simply re-read.
     */
    export async function initialize(): Promise<void> {
        if (built == null)
            throw new Error("Starter.initialize: call Starter.start first.");

        // Read the persisted TypeEntity ids back into the type↔id caches (internally TypeLogic.load).
        // Tolerant of a not-yet-generated database (the `new`/`create` terminal command runs against an
        // empty DB); the deterministic bootstrap then covers reads until generation seeds the table.
        await built.initialize();

        // Warm the culture cache into its sync snapshot: the reflection endpoint answers the culture
        // catalogue on every client boot and cannot await a query there. Tolerant of a not-yet-generated
        // database, like the initialize above.
        try { await CultureInfoLogic.warmUp(); } catch { /* table not created yet — the seeder fills it */ }

        // Load THIS environment's ApplicationConfiguration into its sync snapshot (Signum reads its
        // `Starter.Configuration` lazy on first use; altea's ResetLazy is async and every module's
        // configuration getter is not — see GlobalsLogic). Tolerant of a not-yet-generated or not-yet-seeded
        // database: a module that then asks for its configuration fails with GlobalsLogic's message naming
        // the migration, rather than silently running on defaults.
        try { await GlobalsLogic.warmUp(); } catch (e) { console.warn(`[globals] ${(e as Error).message}`); }
    }

    /**
     * @param options.initialize  Run {@link initialize} as part of starting (the default). A TERMINAL passes
     *   false and initializes per command — see that method.
     */
    export async function start(connectionString: string, webBuilder?: WebBuilder,
        options?: { initialize?: boolean }): Promise<void> {
        // Point eastwind at a database a SIGNUM application generated — a Southwind — and declare only what
        // Southwind declares. Read FIRST because EntityOverrides needs it: an implementedBy list decides
        // which TABLES the schema creates, so it is part of the model, not of module registration.
        const southwindOnly = isEnvTrue(process.env["LegacyMode"]);

        // Shared entity-model declarations (mixins / lite models / implementedBy overrides), applied
        // identically on client and server. Runs before schema build so overrides take effect.
        EntityOverrides.start({ southwindOnly });

        var sb = new SchemaBuilder();
        sb.webBuilder = webBuilder;

        var connector = connectionString.startsWith("postgres")
            ? new (await import("@altea/altea/server/connection/postgresConnector")).PostgresConnector(sb.schema, connectionString)
            : new (await import("@altea/altea/server/connection/sqlServerConnector")).SqlServerConnector(sb.schema, connectionString);

        Connector.default = connector;
        // Signum detects the server version in its connector's CONSTRUCTOR; altea has no synchronous
        // database access, so it is an explicit step here — and it must run BEFORE the schema is built,
        // because that is where a generated GUID key's default generator is decided (guidKeyDefault).
        await connector.detectServerCapabilities();

        sb.settings.isPostgres = connector.isPostgres;

        // Southwind's `ImplementedByAllPrimaryKeyTypes.Add(typeof(Guid))`: the thirteen user-asset row
        // types have uuid keys, so an @implementedByAll reference may point at one. The default is
        // Signum's {int}; nothing here declares a `long` key, so that column is not asked for.
        sb.settings.implementedByAllPkType("uuid");

        // Point eastwind at a database a SIGNUM application generated — a Southwind — and name things the
        // way Signum names them, so `terminal sync` reads as a MIGRATION (the model differences) rather
        // than a rebuild (every table renamed). See SchemaSettings.legacyMode for what it currently covers.
        // Like the dialect above, this is decided while the schema is BUILT, before a row can be read, so
        // it comes from the environment and not from the ApplicationConfiguration row.
        sb.settings.legacyMode = southwindOnly;

        // Two differences a legacy sync must not act on — see each function.
        if (southwindOnly) {
            ignoreSouthwindOnlyConfiguration();
            ignoreRenamedEnumMembers();

            // Field ROUTES that emit no column in Southwind (Signum's
            // `Schema.Settings.FieldAttributes(route).Add(new IgnoreAttribute())`). Unlike a whole module,
            // these are members of a type both applications HAVE — so the type is included either way and
            // only the route stands down. Must precede every `include` below, as it does in Signum's
            // `Starter.OverrideAttributes`.

            // Southwind's `PredictorLogic.IgnorePinned(sb)` — Signum even ASSERTS the app called it
            // (`sb.Settings.AssertIgnored(… p.MainQuery.Filters.Single().Pinned …)`). A predictor's filters
            // are the query it TRAINS on; a pinned filter is a dashboard-interaction facet, meaningless
            // there, and it is seven columns per filter table.
            sb.settings.ignoreFieldRoute(PredictorEntity_Filter, "pinned");
            sb.settings.ignoreFieldRoute(PredictorSubQueryEntity_Filter, "pinned");

            // The two DIRECTORY configurations Southwind does not declare on its settings row (it declares
            // AzureAD alone). Ignoring the route drops 26 columns and, with them, the role-mapping
            // collection each embedded holds — a table apiece.
            sb.settings.ignoreFieldRoute(ApplicationConfigurationEntity, "openID");
            sb.settings.ignoreFieldRoute(ApplicationConfigurationEntity, "windowsAD");
        }

        // Southwind installs a SUBSET of the modules below, and legacy mode is pointed at a Southwind
        // database — so start only what Southwind starts, and a `sync` reads as a migration of the tables
        // both applications HAVE rather than also creating a dozen this one invented. Each gated module is
        // marked "not in Southwind" at its call.
        //
        // It gates the module STARTS, not the app's own entity model: the AD configuration tables come from
        // ApplicationConfiguration declaring those fields, and the mail SERVICE tables from the app widening
        // `EmailServiceEntity`'s implementedBy — different levers, both app-model rather than module.


        // Southwind's ConfigureBigString — WHERE each log table's big text lives. Must run before any of
        // those types is included, because registering a route is what drops the column its mode does not
        // use; hence here rather than beside the module starts below.
        configureBigString(sb);

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
        // Southwind's `SystemEventLogLogic.Start(sb)` (Starter.cs) — one row per process event
        // ("Application Start" / "Application Stop", written by webServer's SystemEventServer.logStartStop).
        // It is the table that answers "was the server up then?", so it is worth having before anything
        // that could go wrong does.
        SystemEventLogLogic.start(sb);

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
        // Southwind's `UserTicketLogic.Start(sb)` (Starter.cs) — the "remember me" ticket table. Opt-in
        // per app, as in Signum: without it a login ignores rememberMe, the checkbox is not rendered, and
        // /api/auth/loginFromCookie answers null. Must follow AuthLogic.start, which owns UserEntity.
        UserTicketLogic.start(sb);
        // Southwind's `SessionLogLogic.Start(sb)` (Starter.cs) — who logged in, from where, for how long.
        // Which roles are recorded is a PERMISSION question, and note which way it defaults: a role with no
        // rule for SessionLogPermission.TrackSession inherits its own default, so eastwind's unrestricted
        // roles ARE tracked from here on (probeSessionLog reports what each role resolves to). Deny the
        // permission to a role that should not be recorded.
        SessionLogLogic.start(sb);
        // Southwind's `TypeConditionLogic.RegisterCompile<UserEntity>(SouthwindTypeCondition.UserEntities,
        // u => u.Is(UserEntity.Current))` (Starter.cs): "the row IS the current user", so a role can be given
        // Read on User restricted to one's own row — which is exactly what terminal/AuthRules.xml does for
        // Standard user. The same symbol also scopes the USER ASSETS by owner further down; a symbol is
        // registered per type, so both registrations are needed.
        TypeConditionLogic.registerCompile(UserEntity, EastwindTypeCondition.UserEntities,
            u => u.is(UserHolder.currentUserLite()));

        // Southwind's `TypeConditionLogic.Register<OrderEntity>(SouthwindTypeCondition.CurrentEmployee,
        // o => o.Employee.Is(EmployeeEntity.Current))` — "the orders I handled". `EmployeeEntity.current()`
        // reads the "Employee" claim the UserEmployeeMixin fills (see entityOverrides), so the whole chain
        // was already here and only the condition was missing.
        //
        // Declaring it grants nothing by itself: a condition only bites once a role has a RULE using it, and
        // neither eastwind's AuthRules.xml nor Southwind's own database has one. It is registered so the
        // symbol EXISTS — a Southwind database holds the row, and without the declaration a sync offers to
        // rename it into an unrelated condition and DELETEs it when that is declined.
        TypeConditionLogic.registerCompile(OrderEntity, EastwindTypeCondition.CurrentEmployee,
            o => o.employee.is(EmployeeEntity.current()));

        // Files module (altea-files): the FileTypeSymbol table, the save / delete hooks for every entity that
        // holds a FilePathEmbedded, and the download routes (Southwind's FilePathEmbeddedLogic.Start +
        // FileLogic.Start). MUST come after AuthLogic.start: express runs handlers in REGISTRATION order, so
        // routes mounted before the auth middleware never see an authenticated user (they 403 as "Not user
        // logged"). The field scan itself runs on `schema.initializing`, so it still covers every module's
        // file fields regardless of where this sits.
        FileLogic.start(sb);
        // Southwind's `BigStringLogic.Start(sb)` — installs the save / retrieve hooks for the routes
        // configureBigString registered above (and, through them, FilePathEmbeddedLogic). It also
        // ASSERTS at schema.initialize() that every BigString route in the schema has a configuration,
        // naming the missing ones; Signum only finds out on the first save.
        BigStringLogic.start(sb);

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
        // Not in Southwind — see southwindOnly.
        if (!southwindOnly) {
            CachedProfilePhotoLogic.start(sb, EastwindFileStores.store("profile-photos", { onlyImages: true }));
        }

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
        // Southwind's `PackageLogic.Start(sb, packages: true, packageOperations: true)`: the algorithms that
        // walk a PACKAGE's lines, plus `PackageOperationProcess.PackageOperation` — the one that applies the
        // operation a PackageOperationEntity names, which is what a contextual "run this on all of them"
        // creates. altea's ProcessLogic already includes the three package tables and their queries, so this
        // adds only the algorithm registry (see that module's header on why Signum's two flags are gone).
        PackageLogic.start(sb);
        // Not in Southwind — see southwindOnly. Signum's ProcessAlgorithmSymbol is not an ITaskEntity, so
        // there is no bridge to start and `scheduled_task.task` keeps its single implementation. The DATA
        // half is gated to match (entityOverrides.data.ts).
        if (!southwindOnly)
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
        // Southwind passes all three (`timeTracker`, `heavyProfiler`, `overrideSessionTimeout`), and each
        // flag is what REGISTERS the matching permission — so all three are passed here too. The
        // session-timeout override itself is still deferred in altea (see ProfilerLogic's header); the flag
        // grants the permission a role can hold, which is what Southwind's database records.
        ProfilerLogic.start(sb, { timeTracker: true, heavyProfiler: true, overrideSessionTimeout: true });

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

        // Machine learning (@altea/altea-machine-learning): the predictor definition, its codification /
        // progress / result rows, and the TensorFlow.js engine. Southwind starts the same module.
        //
        // AFTER ProcessLogic.start, because the Autoconfigure genetic search registers itself as a process
        // algorithm; and its own file store is where a trained model's files go.
        PredictorLogic.start(sb, {
            predictorFile: EastwindFileStores.store("predictor-files"),
        });
        // Southwind's `PredictorLogic.RegisterPublication(ProductPredictorPublication.MonthlySales,
        // new PublicationSettings(typeof(OrderEntity)))`: the trained model published under this name
        // predicts over the ORDER query, which is what SalesEstimation asks for by publication rather
        // than by predictor row. The registration is also what SEEDS the symbol table row.
        PredictorLogic.registerPublication(ProductPredictorPublication.MonthlySales, { queryName: OrderEntity });

        // Token migrations (@altea/altea-user-assets): the version table for the `.tokens.json` files that
        // repair stored query TOKENS after a schema rename. Southwind's `TokenMigrationLogic.Start(sb)`.
        //
        // It comes FIRST of the user-asset modules on purpose: each of them registers its own
        // token-synchronizing subscriber only `if (TokenMigrationLogic.isStarted())`, so starting it later
        // would leave every subscriber silently unregistered — the pass would run and find nothing.
        //
        // The directory is the SAME one the SQL migrations live in, which is the point: a `.tokens.json`
        // sits beside the `.sql` migration whose renames caused it.
        TokenMigrationLogic.migrationsDirectory = () => SqlMigrationRunner.migrationsDirectory;
        TokenMigrationLogic.start(sb);

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
        // …and the SvgMap script is a symbol ROW, so it goes with the rest of what Southwind does not
        // declare: Southwind starts `ChartLogic.Start(sb, googleMapsChartScripts: false)` and passes no
        // svgMapUrls at all.
        ChartLogic.start(sb, southwindOnly ? undefined : ["/sample-maps/regions.svg"]);

        // Per-type color palettes (altea-chart/ColorPalette): the ColorPalette entity + its Save/Delete
        // operations, the palette cache, and GET /api/colorPalette/:typeName (Signum's ColorPaletteLogic).
        // Before OperationLogic.start so its operation symbols get seeded.
        ColorPaletteLogic.start(sb);

        // Dashboards module (altea-dashboard): the Dashboard entity + its Save/Delete/Clone operations, the
        // dashboard cache, XML import/export and the lookup routes (Signum's DashboardLogic.Start). AFTER
        // UserQueriesLogic / UserChartLogic so their part types are registered in the dashboard part registry
        // before a dashboard is imported, and before OperationLogic.start so its operation symbols get seeded.
        DashboardLogic.start(sb);

        // The dashboard SNAPSHOT store (Signum passes `cachedQueryAlgorithm` into DashboardLogic.Start).
        // A snapshot is a JSON result table the BROWSER evaluates each part's query against, so the file is
        // read far more often than it is written — the reason it belongs in a store the app can point at
        // object storage (see EastwindFileStores).
        CachedQueryLogic.start(sb, { fileTypeAlgorithm: EastwindFileStores.store("cached-queries") });
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
        // Not in Southwind — see southwindOnly.
        if (!southwindOnly) {
            TourLogic.start(sb);
        }

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
        // Not in Southwind — see southwindOnly. Signum's `EmailLogic.Start` registers this file type only
        // when the app PASSES an `attachment` algorithm, and Southwind passes none — so its
        // `files.file_type` table has no `EmailFileType.Attachment` row and its templates cannot carry
        // file attachments at all. eastwind gives them a store.
        if (!southwindOnly)
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
        //
        // Not in Southwind — see southwindOnly. Its Starter.cs REGISTERS the package mixin (so a Southwind
        // database has `email_message.package_id`, and eastwind declares it either way) but never calls
        // `EmailPackageLogic.Start`, which is what adds the search page, the two process algorithms and
        // ReSendEmails. The email_package TABLE stays: the mixin's `package` reference reaches it.
        if (!southwindOnly)
            EmailPackageLogic.start(sb);

        // The scheduled task that sends a template to nothing / one target / every row of a user query
        // (Signum.Mailing/Package/SendEmailTaskLogic). After EmailPackageLogic — its UserQuery branch
        // queues a package through it — and after SchedulerLogic, whose task registry it registers into.
        // Not in Southwind — see southwindOnly.
        if (!southwindOnly) {
            SendEmailTaskLogic.start(sb);
        }

        // The two extra SENDER services (@altea/altea-mailing-exchange, -microsoft-graph). Each contributes
        // one service TABLE and registers itself in EmailLogic's sender registry; which one a message actually
        // goes through is decided per EmailSenderConfiguration row, so starting both costs nothing until one
        // is configured. Both re-check that entityOverrides widened EmailSenderConfiguration.service, and fail
        // loudly here rather than at the first send.
        // Not in Southwind — see southwindOnly.
        if (!southwindOnly) {
            MailingExchangeWSLogic.start(sb);
        }
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
        // Not in Southwind — see southwindOnly.
        if (!southwindOnly) {
            Pop3ConfigurationLogic.start(sb);
            EmailReceptionLogic.start(sb);
        }

        // Browsing a user's real Outlook mailbox (@altea/altea-mailing-microsoft-graph's RemoteEmails half).
        // OPT-IN: it registers a search page whose every row is a live Microsoft Graph call, so without an
        // Entra tenant configured it would only ever show an error. EASTWIND_REMOTE_EMAILS=true enables it.
        // …and not in Southwind either — see southwindOnly.
        if (!southwindOnly && process.env["EASTWIND_REMOTE_EMAILS"] === "true")
            RemoteEmailsLogic.start(sb);

        // Alerts module (@altea/altea-alert): the Alert table + the AlertTypeSymbol table, the two endpoints
        // the navbar bell polls and the WebSocket hub that pushes "your alerts changed". AFTER the auth logics
        // (an alert is addressed to a USER) and BEFORE OperationLogic.start so its six operation symbols get
        // seeded. `registerExpressionsFor` is Southwind's `AlertLogic.Start(sb, typeof(UserEntity),
        // typeof(OrderEntity))`: those two types grow the `Alerts` / `MyActiveAlerts` sub-tokens.
        AlertLogic.start(sb, { registerExpressionsFor: [UserEntity, OrderEntity] });

        // Free-text notes on any entity (Signum.Notes). Southwind starts it with the same two types the
        // alerts get, so a note is offered where an alert is.
        NoteLogic.start(sb, { registerExpressionsFor: [UserEntity, OrderEntity] });

        // …and its OPT-IN notification half (Signum's RegisterAlertNotificationMail): the e-mail model and
        // the ScheduledTask that mails each user their pending alerts. AFTER EmailLogic.start (it registers an
        // email model) and after SchedulerLogic.start (it registers a task type).
        // Not in Southwind — see southwindOnly.
        if (!southwindOnly) {
            AlertNotificationLogic.start(sb);
        }

        // Office-template module (altea-office-template): the OfficeTemplate / OfficeModel tables, the
        // OfficeTransformerSymbol / OfficeConverterSymbol symbol tables, the GenerateReport permission, and
        // the three routes (createReport / constructorType / officeTemplates). AFTER altea-email, because
        // an OfficeAttachment hangs off an EmailTemplate; BEFORE OperationLogic.start so its three
        // operations are in the registry when the OperationSymbol table is seeded.
        // Its ATTACHMENT half is opt-in and off against a Southwind database: Signum has no caller for
        // `WordAttachmentLogic.Start` and Southwind calls `WordTemplateLogic.Start(sb)` alone, so that
        // database has the template tables and no word_attachment (and the attachment list stays at two).
        OfficeTemplateLogic.start(sb, { attachments: !southwindOnly });

        // Excel export (altea-office-template's Signum.Excel half): declares no tables — its PlainExcel
        // permission symbol rides along in the PermissionSymbol seed — and mounts POST /api/excel/plain/
        // :queryKey, which turns any query request into an .xlsx download. Its own starter, separate from
        // the importer's (below), so an app can offer export without import.
        PlainExcelLogic.start(sb);

        // Excel import (the other half of the Signum.Excel port, its own starter): mounts POST
        // /api/excel/validateForImport/:queryKey + /api/excel/import/:queryKey, which read an .xlsx back
        // into entities through a chosen operation. Its ImportFromExcel permission rides the same seed.
        ExcelImportLogic.start(sb);

        // Excel REPORTS (the third Signum.Excel half): the excel.excel_report table — a stored .xlsx
        // workbook attached to a query, whose "Data" sheet a report run refills from the search. Its own
        // starter again; Southwind starts all three with one `ExcelLogic.Start(sb, excelReport: true)`.
        //
        // AFTER QueryLogic is running (the entity has a QueryEntity FK) and BEFORE OperationLogic.start,
        // so its Save / Delete symbols are in the registry when the OperationSymbol table is seeded.
        ExcelReportLogic.start(sb);

        // Migrations module (altea-migrations): the SqlMigration / CSharpMigration history tables + the
        // LoadMethodLog every terminal load step writes. Server-only (the runners live in the terminal), and
        // the tables must be part of the schema for `sync` / the load menu to log into them.
        MigrationLogic.start(sb);

        // Visual tips (framework): the "?" icons the SearchControl itself carries, plus the per-user
        // record of which have been read. Signum's Southwind starts this the same way; the four
        // SearchVisualTip symbols are registered by the module itself.
        VisualTipLogic.start(sb);

        // Change log (framework): the per-user "when did I last read it" row. The ENTRIES are source — a
        // Changelog.ts per module, compiled into the client (see client/Basics/ChangeLogClient) — so this
        // table is the whole stored part. Southwind starts it the same way.
        ChangeLogLogic.start(sb);

        // Dynamic module (altea-dynamic): the three VIEW tables (a view defined in the database, a
        // selector that picks between them, an override that rewrites an existing view), the CSS-override
        // table + its anonymous endpoint, the SQL-migration table, and the COMPILED half — a DynamicType
        // is generated as TypeScript, compiled with the quote-transformer and loaded, which is why the
        // compiler is configured first. Before OperationLogic.start so its operation symbols get seeded.
        //
        // `codeGenDirectory` is Signum's CodeGen folder, inside the app: the generated source is written
        // there (readable, git-ignored) and its `node_modules` is what generated imports resolve through.
        // `typesRoots` is what lets generated code import THIS app's own modules
        // (`eastwind/shippers/Shipper.data`): nothing depends on an app, so there is no node_modules entry
        // for TypeScript to follow — the same accommodation @altea/altea-eval needs. A `@altea/*`
        // specifier resolves on its own and needs no entry.
        DynamicCodeCompiler.configure({
            codeGenDirectory: path.join(process.cwd(), "CodeGen"),
            // The app's DIST, not its source: one directory serves both halves, exactly as a published
            // package does. TypeScript reads the `.d.ts` there for checking, and Node loads the `.js` beside it —
            // which is what the emitted relative import resolves to. Pointing at the SOURCE type-checks
            // and then fails at load ("Cannot find module …/shippers/Shipper.data"), because a `.ts` is not
            // what Node runs.
            typesRoots: { eastwind: path.join(process.cwd(), "dist") },
        });
        // `isolations` is opt-in and OFF by default (see the flag): eastwind turns it on to exercise
        // DynamicIsolation, and still never starts @altea/altea-isolation — so no app-wide commitment.
        // …and two sub-modules stand down against a Southwind database: its DynamicLogicStarter.cs starts
        // eight of them by name and neither `DynamicCSSOverrideLogic` nor `DynamicApiLogic` is on the list,
        // so that database has neither table, query nor operation for them. `isolations` is a MIXIN, so it
        // adds a column to dynamic_type — off there too.
        DynamicLogic.start(sb, {
            isolations: !southwindOnly,
            cssOverrides: !southwindOnly,
            apis: !southwindOnly,
        });

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
        // Not in Southwind — see southwindOnly.
        if (!southwindOnly) {
            TreeModuleLogic.start(sb);
            DepartmentsLogic.start(sb);
        }

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
        // Its two OPT-IN halves stand down against a Southwind database: Signum's
        // `SMSLogic.Start(sb, null, …)` reaches neither the send / update-status processes nor the SMSModel
        // registry, so that database has the message and template tables with none of their symbols.
        SMSModuleLogic.start(sb, {
            getConfiguration: () => GlobalsLogic.configuration().sms,
            processes: !southwindOnly,
            models: !southwindOnly,
        });

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
        // …and it goes with the processes it belongs to: registering it reaches
        // `SMSMessageOperation.SendMultipleSMSMessages`, one more operation row than a Southwind database
        // has (see the `processes` flag above).
        if (!southwindOnly)
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
        // Not in Southwind — see southwindOnly.
        if (!southwindOnly) {
            PrintingLogic.start(sb, { testFileType: EastwindFileType.PrintTest });
            // INSIDE the gate with it: a registered file type is a symbol ROW, and the routes reach the
            // module's permission symbol — a module Southwind does not start must contribute neither.
            FileTypeLogic.register(EastwindFileType.PrintTest,
                EastwindFileStores.store("print-test"));
            if (sb.webBuilder)
                PrintingServer.start(sb.webBuilder);
        }

        // Release notes (@altea/altea-whats-new): the news item + its per-culture messages, the read log,
        // and the six routes the navbar bullhorn / overview / news page call. BEFORE OperationLogic.start
        // (five operation symbols to seed).
        //
        // The two FILE TYPES are the module's own; eastwind points both at one folder, as Southwind does
        // for its own two. The PUBLISHED type condition is granted to ordinary users below, next to the
        // other type-condition rules: without it a non-admin sees no news at all, since the row filter is
        // what makes a Draft invisible.
        // Not in Southwind — see southwindOnly.
        if (!southwindOnly) {
            WhatsNewLogic.start(sb);
            // INSIDE the gate too: two file-type symbol rows and a TYPE CONDITION row, none of which a
            // Southwind database has (see the Printing block above).
            FileTypeLogic.register(WhatsNewFileType.WhatsNewPreviewFileType,
                EastwindFileStores.store("whats-new"));
            FileTypeLogic.register(WhatsNewFileType.WhatsNewAttachmentFileType,
                EastwindFileStores.store("whats-new"));
            WhatsNewLogic.registerPublishedTypeCondition(EastwindTypeCondition.PublishedNews);
            if (sb.webBuilder)
                WhatsNewServer.start(sb.webBuilder);
        }

        ViewLogLogic.start(sb, {
            registerExpressionsFor: [
                UserQueryEntity,
                UserChartEntity,
                DashboardEntity,
            ],
        });
        // Translations module (altea-translations): both halves — the pages that edit each PACKAGE's own
        // translations/*.xml files (the code half, nothing stored), and the TranslatedInstance table +
        // its pages (the instance half, for every @translatable route). BEFORE OperationLogic.start so
        // its Save/Delete symbols get seeded; the default translator chain is the offline
        // "already translated elsewhere" one, so no API key is needed.
        // Its REPLACEMENT half is opt-in and off against a Southwind database, for the same reason: Signum
        // has no caller for `TranslationReplacementLogic.Start` and Southwind is not one.
        TranslationLogic.start(sb, { replacements: !southwindOnly });

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
        sb.include(TypeEntity).withQuery();

        // The COMPILED half of altea-dynamic, in Signum's own order: generate + compile + load the dynamic
        // code, run each definition's before-schema block, then let the generated starters INCLUDE their
        // types — all before `sb.complete()`, because a schema is built once. A compile failure is
        // recorded rather than thrown (the server must boot so a bad definition can be fixed) and
        // `registerExceptionIfAny` says so loudly, including that a `sync` would now script DROPs.
        await DynamicLogic.compileDynamicCode();
        DynamicLogic.beforeSchema(sb);
        DynamicLogic.startDynamicModules(sb);
        DynamicLogic.registerExceptionIfAny();

        sb.complete();

        built = sb.schema;

        // Load translations: each installed module's own `translations/` directory (walked from this
        // app's dependency graph), then the app's own `<cwd>/translations` last so it wins a collision.
        loadAppTranslations();


        // Everything that READS the database is deferred to `initialize` (see there for why).
        if (options?.initialize !== false)
            await initialize();

        // The app's own PUBLIC REST surface (Southwind's Public/CatalogAPIController) — what an API key
        // authenticates against and what @altea/altea-rest logs. After every module, so its RestLog
        // middleware sits behind the auth middleware AuthLogic.start installed.
        if (sb.webBuilder) {
            // This deployment's MODE, for the app's own client — EntityOverrides runs on both tiers and
            // needs the same answer (see eastwindMode.server.ts).
            EastwindModeServer.start(sb.webBuilder, { southwindOnly });
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

// Port of Southwind's `Starter.ConfigureBigString` — for each log table whose text can be large, whether
// that text lives in its own column or in a FILE, decided PER PROPERTY ROUTE.
//
// A `BigStringEmbedded` is a wrapper around one unbounded text column; the BigStringMixin hangs a
// FilePathEmbedded off it, and `BigStringLogic` writes the text out on save and reads it back on retrieve,
// so nothing that reads `.text` changes. Registering a route is what DROPS the column the chosen mode does
// not use, which is why this runs before any of these types is included in the schema.
//
// Southwind picks `File` for all five and one store each — separate stores because a deployment may want
// the exception dumps somewhere different from the e-mail bodies. `registerAll` configures every
// BigStringEmbedded route of the type, which is Southwind's call too (ExceptionEntity has three).
//
// Switching an EXISTING database from Database to File is not just a `sync`: the sync would drop the text
// column and the rows would lose their text. Signum's answer, which altea ports, is to deploy once with
// `Migrating_FromDatabase_ToFile` (both columns exist, every save moves the text across), run
// `BigStringLogic.migrateBigStrings(T)`, then switch to `File`.
function configureBigString(sb: SchemaBuilder): void {
    const mode: BigStringMode = "File";

    const stores: [FileTypeSymbol, Type<Entity>, string][] = [
        [BigStringFileType.Exceptions, ExceptionEntity, "exceptions"],
        [BigStringFileType.OperationLog, OperationLogEntity, "operation-log"],
        [BigStringFileType.ViewLog, ViewLogEntity, "view-log"],
        [BigStringFileType.EmailMessage, EmailMessageEntity, "email-message"],
        [BigStringFileType.RestLog, RestLogEntity, "rest-log"],
    ];

    for (const [fileType, type, storeName] of stores) {
        FileTypeLogic.register(fileType, EastwindFileStores.store(storeName));
        BigStringLogic.registerAll(sb, type, new BigStringConfiguration(mode, fileType));
    }

    // Nothing else to register: every BigString route in the schema is one of the five above. There
    // used to be five more — a package's config string, a process / scheduler exception line's element
    // info, a scheduled task log's remarks — registered `Database` purely to stop the mixin giving them
    // file columns nothing wanted. Signum declares all five a plain `string?`, so they are plain strings
    // here now and the question does not arise.
}

// The columns Southwind's `ApplicationConfigurationEntity` stores and eastwind's deliberately does not —
// see that entity's divergence list for why each one is absent:
//
//   Folders_*      one editable path per local file store; here a store's folder is derived from the
//                  store's own NAME, so the paths cannot drift from the code that names the stores.
//   Translation_*  the two translator credentials; @altea/altea-translations reads them from the
//                  environment, and its keys live in each package's own `translations/` directory.
//   AuthTokens_*   altea's counterpart is a server-side interface with one field, taken eagerly from the
//                  host — there is nothing per-environment to store.
//
// Left to itself the synchronizer would offer each of them as a RENAME of some model column, sorted by
// string distance — `folders_view_log_folder` → `open_id_scopes` was a real offer — and DROP whatever the
// developer declined. Both answers are wrong: the columns are not misnamed, and they hold what a Signum
// deployment configured. So in LEGACY MODE they are removed from the database description before it is
// diffed (altea's `simplifyDiffTables`, Signum's SimplifyDiffTables), which leaves them exactly as they
// are — no prompt, no DDL, no data lost — and lets the rest of the table sync as a migration.
//
// NORMAL mode is untouched: there the database is one altea generated, so it has no such columns.
function ignoreSouthwindOnlyConfiguration(): void {
    const prefixes = ["folders_", "translation_", "auth_tokens_"];

    simplifyDiffTables.push(databaseTables => {
        // Found by BARE name: whether the key carries the default schema is a dialect / catalog-reader
        // detail, and this table is in the default schema on both.
        const dif = [...databaseTables.values()].find(t => t.name.name === "application_configuration");
        if (dif == null)
            return;

        for (const name of Object.keys(dif.columns))
            if (prefixes.some(p => name.startsWith(p)))
                delete dif.columns[name];
    });
}

// Enum members altea named better than Signum did, whose TABLE a Southwind database therefore spells
// differently — `basics.exception_origin` holds `Backend_DotNet` / `Frontend_React` where the model says
// `Backend` / `Frontend` (see data/exception.ts for why).
//
// A rename here is not wrong the way the configuration columns above were — it is one UPDATE per row and
// loses nothing — but it is not eastwind's to make: Signum is taking the same two names, so the table
// converges on its own, and a legacy sync that renamed them would be a Southwind database's rows moving
// under it because a second application happened to look. So in LEGACY MODE the table is left alone
// (altea's `simplifyDiffEnums`), which is also the only answer while the two frameworks disagree: the ids
// are the same, so the wrong half of "rename or delete" would orphan every logged exception's origin.
//
// BOTH sides are cleared, never one: a model member left behind with its database row hidden is an INSERT,
// and it collides on the id that row still occupies.
function ignoreRenamedEnumMembers(): void {
    const tables = ["exception_origin"];

    simplifyDiffEnums.push((table, should, current) => {
        if (!tables.includes(table.name.name))
            return;

        should.clear();
        current.clear();
    });
}
