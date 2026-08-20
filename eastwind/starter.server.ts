import "@altea/altea/server/context.node"; // register server context storage first
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // sb.include(...).withQuery()
import { Connector } from "@altea/altea/server/connection/connector";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { TypeEntity } from "@altea/altea/data/typeEntity";
import type { Entity, Type } from "@altea/altea/data/entity";
import { SignumServer } from "@altea/altea/server/signumServer";
import type { WebBuilder } from "@altea/altea/server/webApi";
import { ExceptionLogic } from "@altea/altea/server/exceptionLogic";
import { OperationLogic } from "@altea/altea/server/operationLogic";
import { loadAppTranslations } from "@altea/altea/server/translations";
import { EntityOverrides } from "./entityOverrides.data";
import { EmployeesLogic } from "./employees/Employee.server";
import { ProductsLogic } from "./products/Product.server";
import { ShippersLogic } from "./shippers/Shipper.server";
import { CustomersLogic } from "./customers/CustomerLogic.server";
import { OrdersLogic } from "./orders/Order.server";
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
import { EmailLogic } from "@altea/altea-email/server/EmailLogic.server";
import { FileTypeLogic } from "@altea/altea-files/server/FileTypeLogic.server";
import { FileTypeAlgorithm } from "@altea/altea-files/server/FileTypeAlgorithm.server";
import { EmailFileType } from "@altea/altea-email/data/Email";
import { EastwindEmail } from "./eastwindEmail.server";
import { OfficeTemplateLogic } from "@altea/altea-office-template/server/OfficeTemplateLogic.server";
import { ToolbarLogic } from "@altea/altea-toolbar/server/ToolbarLogic.server";
import { PlainExcelLogic } from "@altea/altea-office-template/server/excel/PlainExcelLogic.server";
import { ExcelImportLogic } from "@altea/altea-office-template/server/excel/ExcelImportLogic.server";
import { MigrationLogic } from "@altea/altea-migrations/server/MigrationLogic.server";
import { EastwindTypeCondition } from "./eastwindTypeConditions.data";

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

        // Framework logic (Signum's part of Starter.Start): the exception log table.
        ExceptionLogic.start(sb);

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

        // Profiler module (altea-profiler): declares no tables (state is in-memory); mounts the
        // /api/profilerHeavy/* + /api/profilerTimes/* routes and its permission symbols (seeded via the
        // PermissionSymbol table above). After the auth logics so its permissions land in the same seed.
        ProfilerLogic.start(sb, { timeTracker: true, heavyProfiler: true });

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
        FileTypeLogic.register(EmailFileType.Attachment, new FileTypeAlgorithm({
            physicalPrefix: () => process.env["EASTWIND_MAIL_ATTACHMENTS"] ?? "./files/emailAttachments",
        }));
        EmailLogic.start(sb, {
            getConfiguration: () => EastwindEmail.configuration(),
            getSenderConfiguration: EastwindEmail.senderConfiguration,
        });

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

        // Mount the framework HTTP API last (Signum's SignumServer.Start): after the modules' own routes
        // (registered by their Logic.start above) so the auth middleware/gate run first, and so the JSON
        // exception filter — Express error middleware, registered inside SignumServer.start — is truly last.
        if (sb.webBuilder)
            SignumServer.start(sb.webBuilder);
    }
}
