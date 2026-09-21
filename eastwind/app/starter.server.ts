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
import { simplifyDiffTables } from "@altea/altea/server/sync/schemaSynchronizer";
import { EntityOverrides } from "./entityOverrides.data";
import { EmployeesLogic } from "./employees/EmployeeLogic.server";
import { ProductsLogic } from "./products/ProductLogic.server";
import { ShippersLogic } from "./shippers/ShipperLogic.server";
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
import { ProcessLogic } from "@altea/altea-processes/server/ProcessLogic";
import { PackageLogic } from "@altea/altea-processes/server/PackageLogic";
import { ProcessSchedulerBridge } from "@altea/altea-processes/server/ProcessSchedulerBridge";
import { OmniboxLogic } from "@altea/altea-omnibox/server/OmniboxLogic";
import { MapLogic } from "@altea/altea-map/server/MapLogic";
import { HelpModuleLogic } from "@altea/altea-help/server/HelpModuleLogic";
import { DiffLogLogic } from "@altea/altea-diff-log/server/DiffLogLogic";
import { TimeMachineLogic } from "@altea/altea-time-machine/server/TimeMachineLogic";
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
import { PublicLogic } from "./publicApi/PublicLogic.server";
import { TourLogic } from "@altea/altea-tour/server/TourLogic";
import { TranslationLogic } from "@altea/altea-translations/server/TranslationLogic";
import { AzureTranslator, DeepLTranslator } from "@altea/altea-translations/server/Translators";
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
import { HtmlEditorLogic } from "@altea/altea-html-editor/server/HtmlEditorLogic";
import { ExcelReportLogic } from "@altea/altea-office-template/server/excel/ExcelReportLogic";
import { MigrationLogic } from "@altea/altea-migrations/server/MigrationLogic";
import { SqlMigrationRunner } from "@altea/altea-migrations/server/SqlMigrationRunner";
import { TokenMigrationLogic } from "@altea/altea-user-assets/server/TokenMigrationLogic";
import { PredictorLogic } from "@altea/altea-machine-learning/server/PredictorLogic";
import { PredictorEntity_Filter, PredictorSubQueryEntity_Filter } from "@altea/altea-machine-learning/data/Predictor";
import { VisualTipLogic } from "@altea/altea/server/visualTipLogic";
import { ChangeLogLogic } from "@altea/altea/server/changeLogLogic";
import { ApplicationConfigurationEntity, EastwindTypeCondition, EastwindAgentUseCases,  BigStringFileType } from "./globals/ApplicationConfiguration.data";
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

// The single global entry that builds the schema, binds the connector, registers each module's logic and
// completes.
//
// Kept THIN — one line per module — and ordered by DEPENDENCY: the framework first, then each altea module
// after the ones it builds on, and the APP's own domains last. Every "why is this call here and not there"
// note lives in the repo AGENTS.md; read it before moving one. The trailing `//<Name>` markers on a block's
// closing line are anchors for Modules.xml.
export namespace Starter {
    /** The built schema, kept so a host that DEFERRED initialization can run it later (see `initialize`). */
    let built: Schema | undefined;

    /**
     * Read the persisted ids and warm the caches that need the database. Separate from `start` because WHEN
     * it happens differs by host. Idempotent.
     */
    export async function initialize(): Promise<void> {
        if (built == null)
            throw new Error("Starter.initialize: call Starter.start first.");

        await built.initialize();

        // The warm-up tolerates a not-yet-generated / not-yet-seeded database: the `new` terminal command
        // runs against an empty one, and a module that then asks for its configuration fails with
        // GlobalsLogic's message naming the migration rather than silently running on defaults.
        // (Cultures need none — every reader asks CultureInfoLogic for them and it loads on demand.)
        try { await GlobalsLogic.warmUp(); } catch (e) { console.warn(`[globals] ${(e as Error).message}`); }
    }

    /**
     * @param webBuilder  Each module mounts its own HTTP surface through it. A terminal / test omits it
     *   (no HTTP).
     * @param options.initialize  Run {@link initialize} as part of starting (the default). A TERMINAL passes
     *   false and initializes per command — see that method.
     */
    export async function start(connectionString: string, webBuilder?: WebBuilder,
        options?: { initialize?: boolean }): Promise<void> {
        // Point eastwind at a database a LEGACY application generated, and declare only what that
        // application declares. Read FIRST because EntityOverrides needs it.
        const legacyMode = isEnvTrue(process.env["LegacyMode"]);

        // Shared entity-model declarations (mixins / lite models / implementedBy overrides), applied
        // identically on client and server. Before the schema build, so overrides take effect.
        EntityOverrides.start({ legacyMode });

        var sb = new SchemaBuilder();
        sb.webBuilder = webBuilder;

        var connector = connectionString.startsWith("postgres")
            ? new (await import("@altea/altea/server/connection/postgresConnector")).PostgresConnector(sb.schema, connectionString)
            : new (await import("@altea/altea/server/connection/sqlServerConnector")).SqlServerConnector(sb.schema, connectionString);

        Connector.default = connector;
        await connector.detectServerCapabilities();

        sb.settings.isPostgres = connector.isPostgres;
        sb.settings.implementedByAllPkType("uuid");
        sb.settings.legacyMode = legacyMode;

        // What a legacy sync must not act on: the configuration columns, and the field ROUTES that emit no
        // column there. All of it must precede every `include` below.
        if (legacyMode) {
            ignoreConfigurationsForLegacyOnly();

            sb.settings.ignoreFieldRoute(PredictorEntity_Filter, "pinned");
            sb.settings.ignoreFieldRoute(PredictorSubQueryEntity_Filter, "pinned");

            // The two DIRECTORY configurations a legacy database does not declare (AzureAD alone).
            sb.settings.ignoreFieldRoute(ApplicationConfigurationEntity, "openID");
            sb.settings.ignoreFieldRoute(ApplicationConfigurationEntity, "windowsAD");
        }//LegacyMode

        // WHERE each log table's big text lives. Before any of those types is included, because registering
        // a route is what drops the column its mode does not use.
        configureBigString(sb);

        // ==== The FRAMEWORK (@altea/altea) ============================================================

        // Cache module — FIRST of all module starts (AGENTS.md, rule 4). `PostgresBroadcast` is loaded
        // lazily for the same reason the connector is: a static import would pull `pg` into a SQL Server host.
        const serverBroadcast = connector.isPostgres
            ? new (await import("@altea/altea-cache/server/Broadcast/PostgresBroadcast")).PostgresBroadcast()
            : undefined;
        CacheLogic.start(sb, { serverBroadcast });//Cache

        ExceptionLogic.start(sb);
        SystemEventLogLogic.start(sb);
        CultureInfoLogic.start(sb);

        // The OperationSymbol table + the operation log. It may be started HERE, before a single graph has
        // registered, because the symbol list is read through a thunk that SymbolLogic evaluates only when
        // the table is generated / synchronized / loaded — see OperationLogic.start. What must come after
        // it is whatever DECORATES the log (altea-diff-log, altea-time-machine), further down.
        OperationLogic.start(sb);

        VisualTipLogic.start(sb);
        // Change log: the per-user "when did I last read it" row. The ENTRIES are source — a Changelog.ts
        // per module, compiled into the client — so this table is the whole stored part.
        ChangeLogLogic.start(sb);

        // A search query for the TypeEntity system table: included by the schema core but never
        // `.withQuery()`'d, so `/find/Type` reported "not allowed". Scoped to eastwind rather than the
        // framework, to avoid re-seeding the framework suite's query table.
        sb.include(TypeEntity).withQuery();

        // The migration history tables + the LoadMethodLog every terminal load writes. Server-only (the
        // runners live in the terminal); the tables must be in the schema for `sync` and the load menu to
        // log into them. Before TokenMigrationLogic, which points at the same directory.
        MigrationLogic.start(sb);

        // ==== AUTHORIZATION (@altea/altea-auth) =======================================================

        // Authentication + the five authorization dimensions. The second user name is the app's
        // unauthenticated posture.
        AuthLogic.start(sb, "System", "Anonymous");
        TypeAuthLogic.start(sb);
        PermissionAuthLogic.start(sb);
        OperationAuthLogic.start(sb);
        QueryAuthLogic.start(sb);
        PropertyAuthLogic.start(sb);
        UserTicketLogic.start(sb);
        SessionLogLogic.start(sb);

        // The "the row IS the current user" condition, which also scopes the USER ASSETS by owner further
        // down; a symbol is registered per type, so both registrations are needed. (Its sibling,
        // `CurrentEmployee`, is about an app type and goes with the app's domains at the bottom.)
        TypeConditionLogic.registerCompile(UserEntity, EastwindTypeCondition.UserEntities,
            u => u.is(UserHolder.currentUserLite()));

        // ==== FILES (@altea/altea-files) ==============================================================

        // After AuthLogic.start, so their routes are mounted behind the auth middleware (rule 2).
        FileLogic.start(sb);
        BigStringLogic.start(sb);

        // ==== DIRECTORY LOGIN (auth sub-modules; need auth + files) ===================================

        // Directory login modules. AzureAD is started unconditionally, so its ADGroup /
        // CachedProfilePhoto tables are part of the schema whether or not a tenant is configured; OpenID and
        // WindowsAD contribute no tables and only REPLACE the installed authorizer.
        AzureADLogic.start(sb, {
            getConfig: () => EastwindAuthAD.azureADConfiguration(),
            adGroupsAndQueries: true,
            deactivateUsersTask: true,
        });//AzureAD
        // The photo store; `CachedProfilePhotoLogic.start` registers the file type itself, so the app only
        // supplies the algorithm. `onlyImages` is what makes an Azure / S3 store serve these INLINE.
        if (!legacyMode) {
            CachedProfilePhotoLogic.start(sb, EastwindFileStores.store("profile-photos", { onlyImages: true }));
        }//CachedProfilePhoto

        OpenIDLogic.start(sb, () => EastwindAuthAD.openIDConfiguration(),
            { installAuthorizer: EastwindAuthAD.provider() === "openid" });//OpenID

        if (EastwindAuthAD.provider() === "windowsad")
            WindowsADLogic.start(sb, {
                getConfig: () => EastwindAuthAD.windowsADConfiguration(),
                deactivateUsersTask: true,
            });//WindowsAD

        // ==== SCHEDULING AND PROCESSES ================================================================

        // The two symbol tables here are seeded from a THUNK, so a task or an algorithm registered LATER —
        // by a module below, or by an app domain at the bottom — is still seeded. Order does not matter.
        SchedulerLogic.start(sb);
        ProcessLogic.start(sb);
        PackageLogic.start(sb);
        // A legacy database has no bridge: its process-algorithm symbol is not a task entity, so
        // `scheduled_task.task` keeps its single implementation there (gated to match in
        // entityOverrides.data.ts).
        if (!legacyMode)
            ProcessSchedulerBridge.start(sb);

        // ==== EVAL (@altea/altea-eval) ================================================================

        // The COMPILER configuration plus the registry of what a stored script may import
        // (eastwindEval.server.ts). BEFORE
        // every module whose entities carry an EvalEmbedded: the templates' `applicable`, the workflow's eight.
        EastwindEval.start(sb);

        // ==== USER ASSETS =============================================================================

        // Token migrations — FIRST of the user-asset modules. Its directory is the SQL
        // migrations' one: a `.tokens.json` sits beside the `.sql` whose renames caused it.
        TokenMigrationLogic.migrationsDirectory = () => SqlMigrationRunner.migrationsDirectory;
        TokenMigrationLogic.start(sb);//TokenMigration

        // The user assets, and the row-level owner scoping on each: a role whose rule uses these
        // conditions sees only its own + the shared/global assets.
        UserQueriesLogic.start(sb);
        UserQueriesLogic.registerUserTypeCondition(EastwindTypeCondition.UserEntities);
        UserQueriesLogic.registerRoleTypeCondition(EastwindTypeCondition.RoleEntities);//UserQuery

        UserChartLogic.start(sb);
        UserChartLogic.registerUserTypeCondition(EastwindTypeCondition.UserEntities);
        UserChartLogic.registerRoleTypeCondition(EastwindTypeCondition.RoleEntities);
        // `svgMapUrls` registers the opt-in SvgMap chart with the sample map served from public/ — a symbol
        // ROW, so it goes with the rest of what a legacy database does not declare.
        ChartLogic.start(sb, legacyMode ? undefined : ["/sample-maps/regions.svg"]);
        ColorPaletteLogic.start(sb);//Chart

        DashboardLogic.start(sb);
        // The dashboard SNAPSHOT store. A
        // snapshot is read far more often than written, hence a store the app can point at object storage.
        CachedQueryLogic.start(sb, { fileTypeAlgorithm: EastwindFileStores.store("cached-query") });
        DashboardLogic.registerUserTypeCondition(EastwindTypeCondition.UserEntities);
        DashboardLogic.registerRoleTypeCondition(EastwindTypeCondition.RoleEntities);//Dashboard

        ToolbarLogic.start(sb);
        ToolbarLogic.registerUserTypeCondition(EastwindTypeCondition.UserEntities);
        ToolbarLogic.registerRoleTypeCondition(EastwindTypeCondition.RoleEntities);//Toolbar

        // Guided in-app tours.
        if (!legacyMode) {
            TourLogic.start(sb);
        }//Tour

        // ==== COMMUNICATION (needs files, scheduler, processes, eval) =================================

        // Registered only when the app passes an `attachment` algorithm, which a legacy database's
        // templates do not, so they cannot carry attachments at all.
        if (!legacyMode)
            FileTypeLogic.register(EmailFileType.Attachment,
                EastwindFileStores.store("email-attachments"));//EmailAttachment

        // Self-service password reset — BEFORE EmailLogic.start, whose EmailModel table its two models seed.
        ResetPasswordRequestLogic.start(sb);//ResetPassword

        // Email + templating. The app supplies only what is app-specific — the configuration and the sender.
        EmailLogic.start(sb, {
            getConfiguration: () => GlobalsLogic.configuration().email,
            getSenderConfiguration: async () => GlobalsLogic.configuration().emailSender,
        });

        // The BATCH half. A legacy database REGISTERS the package mixin (so it has
        // `email_message.package_id`, and eastwind declares it either way) but never starts this, which is
        // what adds the search page, the two process algorithms and ReSendEmails.
        if (!legacyMode)
            EmailPackageLogic.start(sb);//EmailPackage

        // The scheduled task that sends a template to nothing / one target / every row of a user query.
        if (!legacyMode) {
            SendEmailTaskLogic.start(sb);
        }//SendEmailTask

        // The extra SENDER services. Each contributes one service TABLE and registers itself in EmailLogic's
        // sender registry; which one a message goes through is decided per EmailSenderConfiguration row, so
        // starting both costs nothing until one is configured. Both re-check that entityOverrides widened
        // `EmailSenderConfiguration.service` and fail loudly here rather than at the first send.
        if (!legacyMode) {
            MailingExchangeWSLogic.start(sb);
        }//MailingExchangeWS
        MailingMicrosoftGraphLogic.start(sb);

        // The INBOUND half.
        if (!legacyMode) {
            Pop3ConfigurationLogic.start(sb);
            EmailReceptionLogic.start(sb);
        }//MailingReception

        // Browsing a user's real Outlook mailbox. OPT-IN: it registers a search page whose every row is a
        // live Microsoft Graph call, so without an Entra tenant it would only ever show an error.
        if (!legacyMode && process.env["EASTWIND_REMOTE_EMAILS"] === "true")
            RemoteEmailsLogic.start(sb);//RemoteEmails

        // `registerExpressionsFor`: the types that grow the `Alerts` / `MyActiveAlerts` sub-tokens.
        // Notes get the same two.
        // Naming an APP type here is fine before its domain is included: registering an expression stores a
        // ctor-keyed entry and touches no table.
        AlertLogic.start(sb, { registerExpressionsFor: [UserEntity, OrderEntity] });
        NoteLogic.start(sb, { registerExpressionsFor: [UserEntity, OrderEntity] });

        // Its OPT-IN notification half: the e-mail model and the
        // ScheduledTask that mails each user their pending alerts.
        if (!legacyMode) {
            AlertNotificationLogic.start(sb);
        }//AlertNotification

        // SMS. `provider` is deliberately UNSET — no gateway ships with the module. Its two OPT-IN halves
        // stand down against a legacy database, which reaches neither the
        // send / update-status processes nor the SMSModel registry. (The app's own SMS OWNERS are
        // registered with the app's domains at the bottom.)
        SMSModuleLogic.start(sb, {
            getConfiguration: () => GlobalsLogic.configuration().sms,
            processes: !legacyMode,
            models: !legacyMode,
        });//SMS

        // ==== DOCUMENTS (needs email, files) ==========================================================

        // Office templates. Its ATTACHMENT half is off against a legacy database, which has no caller
        // for it.
        OfficeTemplateLogic.start(sb, { attachments: !legacyMode });//OfficeTemplate

        // The three Excel halves, each its own starter so an app can offer export without import.
        PlainExcelLogic.start(sb);
        ExcelImportLogic.start(sb);
        ExcelReportLogic.start(sb);//Excel

        // The HTML editor is a UI control with no table, but its messages must be registered on the SERVER
        // or the translation sync cannot see them (see HtmlEditorLogic).
        HtmlEditorLogic.start(sb);//HtmlEditor

        // ==== RELEASE NOTES (needs files) ============================================================

        // The PUBLISHED type condition is what makes a Draft invisible to a non-admin. Two file-type
        // symbol rows and a TYPE CONDITION row are INSIDE the gate, because a module a legacy database
        // does not start must contribute neither a symbol row nor a permission.
        if (!legacyMode) {
            WhatsNewLogic.start(sb);
            FileTypeLogic.register(WhatsNewFileType.WhatsNewPreviewFileType,
                EastwindFileStores.store("whats-new"));
            FileTypeLogic.register(WhatsNewFileType.WhatsNewAttachmentFileType,
                EastwindFileStores.store("whats-new"));
            WhatsNewLogic.registerPublishedTypeCondition(EastwindTypeCondition.PublishedNews);
            if (sb.webBuilder)
                WhatsNewServer.start(sb.webBuilder);
        }//WhatsNew

        // ==== MACHINE LEARNING (needs processes, files, chart) ========================================

        PredictorLogic.start(sb, {
            predictorFile: EastwindFileStores.store("predictor-models"),
        });//Predictor

        // ==== DYNAMIC AND WORKFLOW (need eval, scheduler, processes, auth) ============================

        // Dynamic module. The COMPILER is configured first — a DynamicType is generated as TypeScript,
        // compiled with the quote-transformer and loaded. `typesRoots` points at the app's DIST, not its
        // source: one directory serves type-checking and loading, exactly as a published package does
        //.
        DynamicCodeCompiler.configure({
            codeGenDirectory: path.join(process.cwd(), "CodeGen"),
            typesRoots: { eastwind: path.join(process.cwd(), "dist") },
        });
        // `isolations` is opt-in and OFF by default: eastwind turns it on to exercise DynamicIsolation and
        // still never starts @altea/altea-isolation, so no app-wide commitment. Two sub-modules stand down
        // against a legacy database, which starts neither
        // DynamicCSSOverrideLogic nor DynamicApiLogic.
        DynamicLogic.start(sb, {
            isolations: !legacyMode,
            cssOverrides: !legacyMode,
            apis: !legacyMode,
        });//Dynamic

        // Workflow. A legacy database starts the module but declares no main entity, so nothing could run
        // through it; eastwind makes ORDER one — with the app's domains at the bottom.
        WorkflowLogicStarter.start(sb, () => GlobalsLogic.configuration().workflow);//Workflow

        // ==== CROSS-CUTTING: navigation, docs, logs, presence =========================================

        // Omnibox, then the three modules that push a generator onto it.
        OmniboxLogic.start(sb);
        MapLogic.start(sb);
        // The image store is the app's.
        HelpModuleLogic.start(sb, EastwindFileStores.store("help-image", { onlyImages: true }));//Help

        // The API-key table + its authenticator, and the replayable log of the public REST surface.
        // The two halves (log + api key) are one start per module.
        RestModuleLogic.start(sb);

        // Live presence on an open entity, and the profiler pages. Both after the auth logics (the
        // presence hub authenticates with the same bearer token; the profiler's three permissions land in
        // the same seed), and ConcurrentUser after CacheLogic, whose broadcast it subscribes to.
        ConcurrentUserLogic.start(sb);
        ProfilerLogic.start(sb, { timeTracker: true, heavyProfiler: true, overrideSessionTimeout: true });

        // Agent module: skill classes, then the chatbot's own agent, then the app's MCP agent. AFTER the
        // chart module — the ChartSkill reads ChartScriptLogic's registered scripts.
        CurrentServerContextSkill.urlLeft = () => GlobalsLogic.configuration().email.urlLeft;
        IntroductionSkill.applicationName = "eastwind";
        ChatbotLogic.start(sb, () => GlobalsLogic.configuration().chatbot);
        ChatbotLogic.registerUserTypeCondition(EastwindTypeCondition.UserEntities);
        AgentLogic.start(sb, EastwindAgent.chatbotSkill);
        AgentLogic.registerAgent(EastwindAgentUseCases.MCP, EastwindAgent.mcpSkill);//Agent

        // `registerExpressionsFor` — the three user assets whose search pages get
        // the "who looked at this?" sub-tokens.
        ViewLogLogic.start(sb, {
            registerExpressionsFor: [
                UserQueryEntity,
                UserChartEntity,
                DashboardEntity,
            ],
        });//ViewLog

        // Translations, both halves. Its REPLACEMENT half is off against a legacy database, which has
        // no caller for it.
        //
        // The two machine translators take their credentials as LAMBDAS over the
        // configuration row, so rotating a key is a save rather than a restart. Either may be unset — each
        // answers null for a missing key, which the chain reads as "nothing to suggest" — and the
        // always-available AlreadyTranslatedTranslator is prepended by `start` itself.
        TranslationLogic.start(sb, {
            replacements: !legacyMode,
            translators: [
                new AzureTranslator(
                    () => GlobalsLogic.configuration().translation.azureCognitiveServicesAPIKey,
                    () => GlobalsLogic.configuration().translation.azureCognitiveServicesRegion),
                new DeepLTranslator(() => GlobalsLogic.configuration().translation.deepLAPIKey),
            ],
        });//Translation

        // The two modules that DECORATE the operation log, so they come after OperationLogic.start above.
        // `registerAll`: dump EVERY entity type, not an opt-in list.
        DiffLogLogic.start(sb, { registerAll: true });//DiffLog
        TimeMachineLogic.start(sb);

        // The admin HTTP surfaces of the modules whose logic had to start earlier — mounted HERE so they
        // sit behind the auth middleware (AGENTS.md, rule 2).
        if (sb.webBuilder)
            CacheServer.start(sb.webBuilder);
        if (sb.webBuilder) {
            ChatbotServer.start(sb.webBuilder);
            // The MCP endpoint exposes the app's MCP agent's skill tree to an EXTERNAL host.
            AgentMcpServer.start(sb.webBuilder, EastwindAgentUseCases.MCP);
        }//AgentServer

        // ==== THE APP (eastwind) ======================================================================
        //
        // Everything above is framework or module; everything below is this application. The domains come
        // LAST because they depend on every module and nothing depends on them — a domain's scheduled
        // tasks, process algorithms and workflow wiring are all registered from its own Logic.start, and
        // each of those registries is read through a thunk after the whole schema is built.

        EmployeesLogic.start(sb);
        ProductsLogic.start(sb);
        ShippersLogic.start(sb);
        CustomersLogic.start(sb);
        OrdersLogic.start(sb);

        // The second type condition: "the orders I handled" — `EmployeeEntity.current()` reads the
        // claim UserEmployeeMixin fills. It grants nothing by itself; it exists so the SYMBOL does (a
        // legacy database holds the row).
        TypeConditionLogic.registerCompile(OrderEntity, EastwindTypeCondition.CurrentEmployee,
            o => o.employee.is(EmployeeEntity.current()));

        // ORDER as a workflow case main entity (orders/OrderWorkflow.server.ts) — a legacy database declares
        // none, so nothing could run through its workflow module.
        OrderWorkflow.registerOrderAsMainEntity(sb);

        // The SMS owner: a CUSTOMER (Northwind's customers carry a phone) — a legacy database registers none,
        // so without this the module would have nothing to be about. The sub-token is registered PER
        // CONCRETE TYPE; the "send to all of these" OPERATION once, on the abstract base.
        SMSLogic.registerSMSOwner(PersonEntity);
        SMSLogic.registerSMSOwner(CompanyEntity);
        if (!legacyMode)
            SMSProcessLogic.registerSMSOwnerData(CustomerEntity, c => ({
                owner: c.toLite(), telephoneNumber: c.phone, culture: null,
            }));//SMSOwner

        // The publication: the
        // model published under this name predicts over the ORDER query. The registration also SEEDS the symbol row.
        PredictorLogic.registerPublication(ProductPredictorPublication.MonthlySales, { queryName: OrderEntity });

        // The app's own GLOBALS: the ApplicationConfiguration table
        // every configuration lambda above reads through `GlobalsLogic.configuration()`. LAST of the
        // includes — the row references and embeds the types every module
        // above created.
        GlobalsLogic.start(sb);

        // The COMPILED half of altea-dynamic — all before `sb.complete()`, because a
        // schema is built once. `registerExceptionIfAny` reports a compile failure loudly, including that a
        // `sync` would now script DROPs.
        await DynamicLogic.compileDynamicCode();
        DynamicLogic.beforeSchema(sb);
        DynamicLogic.startDynamicModules(sb);
        DynamicLogic.registerExceptionIfAny();//DynamicCompiled

        sb.complete();

        built = sb.schema;

        // Each installed module's own `translations/` directory (walked from this app's dependency graph),
        // then the app's own `<cwd>/translations` last so it wins a collision.
        loadAppTranslations();

        // Everything that READS the database is deferred to `initialize` (see there for why).
        if (options?.initialize !== false)
            await initialize();

        // The app's own REST surfaces. After every module, so the RestLog
        // middleware sits behind the auth middleware AuthLogic.start installed.
        if (sb.webBuilder) {
            // This deployment's MODE, for the app's own client — EntityOverrides runs on both tiers and
            // needs the same answer (see eastwindMode.server.ts).
            EastwindModeServer.start(sb.webBuilder, { legacyMode });
            CatalogApi.start(sb.webBuilder);
            PublicCatalogApi.start(sb.webBuilder);
            // The ROLE a self-registered visitor is given is the app's decision, not the module's, so it is
            // named here rather than inside the controller; it must be one createRoles seeds.
            PublicLogic.start(sb.webBuilder, { registeredUserRoleName: "Standard user" });
        }//PublicApi

        // The framework HTTP API LAST: its JSON exception filter is Express
        // error middleware, which must be registered after every route.
        if (sb.webBuilder)
            SignumServer.start(sb.webBuilder);
    }
}

/** A boolean read off the environment: "true" / "1" in any casing; anything else (unset included) is false. */
function isEnvTrue(value: string | undefined): boolean {
    const v = value?.trim().toLowerCase();
    return v === "true" || v === "1";
}

// For each log table whose text can be large, whether that text lives in its own column or in a FILE,
// decided PER PROPERTY ROUTE. See AGENTS.md before changing a mode: switching an existing database
// from Database to File is not just a `sync`.
function configureBigString(sb: SchemaBuilder): void {
    registerBigString(sb, ExceptionEntity, BigStringFileType.Exceptions, "exceptions");
    registerBigString(sb, OperationLogEntity, BigStringFileType.OperationLog, "operation-logs");
    registerBigString(sb, ViewLogEntity, BigStringFileType.ViewLog, "view-logs");
    registerBigString(sb, EmailMessageEntity, BigStringFileType.EmailMessage, "email-messages");
    registerBigString(sb, RestLogEntity, BigStringFileType.RestLog, "rest-logs");
}//ConfigureBigString

function registerBigString(sb: SchemaBuilder, type: Type<Entity>, fileType: FileTypeSymbol,
    storeName: string, mode: BigStringMode = "File"): void {
    FileTypeLogic.register(fileType, EastwindFileStores.store(storeName));
    BigStringLogic.registerAll(sb, type, new BigStringConfiguration(mode, fileType));
}

// LEGACY MODE only. The columns the legacy ApplicationConfigurationEntity stores and this one deliberately
// does not (Folders_* / Translation_* / AuthTokens_*). Left to itself the synchronizer offers each as a
// RENAME of whatever model column sorts nearest by string distance and DROPs the declined ones — both
// answers wrong.
function ignoreConfigurationsForLegacyOnly(): void {
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
}//ignoreConfigurationsForLegacyOnly
