// EntityOverrides — the shared client+server home for static, per-model declarations that BOTH tiers
// must apply before any entity is (de)serialized or any schema/UI is built:
//   - mixin registration          (Signum's MixinDeclarations.Register)
//   - lite-model constructors      (Signum's [LiteModel] / registerCustomLite)
//   - implementedBy overrides      (Signum's [ImplementedBy] override / OverrideAttributes)
//
// These are NOT shipped by the /api/reflection/metadata endpoint: they are identical for every user and
// culture, and the entity serializer needs mixins + implementedBy to reconstruct graphs — so they must
// exist before the metadata response can even be parsed. Living here (the shared entities layer) means
// the server Starter and the client bootstrap run the exact same declarations.
//
// Today: four mixins (three of them a module's, plus the app's own UserEmployeeMixin), every lite model
// is the default, and implementedBy is declared inline via @implementedBy on OrderEntity.customer.
import { overrideImplementedBy } from "@altea/altea/data/decorators";
import { renameSymbolContainer } from "@altea/altea/data/reflection";
import { setLegacyPropertyPaths } from "@altea/altea/data/propertyRoute";
import { useLegacyWordNames } from "@altea/altea-office-template/data/OfficeTemplate";
import { BigStringMixin } from "@altea/altea-files/data/BigString";
import { ApplicationConfigurationEntity, EastwindTypeCondition, EastwindAgentUseCases } from "./globals/ApplicationConfiguration.data";
import { ProcessEntity, ProcessExceptionLineEntity } from "@altea/altea-processes/data/Processes";
import { PackageEntity, PackageOperationEntity, PackageLineEntity } from "@altea/altea-processes/data/Package";
import { EmailPackageEntity } from "@altea/altea-email/data/EmailPackage";
import { EmailTemplateEntity_Attachment, ImageAttachmentEntity } from "@altea/altea-email/data/EmailTemplate";
import { AutoconfigureNeuralNetworkEntity } from "@altea/altea-machine-learning/data/NeuralNetworkSettings";
import { AzureADRoleMappingEntity } from "@altea/altea-auth-azuread/data/AzureAD";
import { OpenIDRoleMappingEntity } from "@altea/altea-auth-openid/data/OpenID";
import { WindowsADRoleMappingEntity } from "@altea/altea-auth-windowsad/data/WindowsAD";
import type { Entity, Type } from "@altea/altea/data/entity";
import { ExceptionEntity } from "@altea/altea/data/exception";
import { RestLogEntity } from "@altea/altea-rest/data/Rest";
import { ViewLogEntity } from "@altea/altea-view-log/data/ViewLog";
import { OperationLogEntity } from "@altea/altea/data/operationLog";
import { UserEntity } from "@altea/altea-auth/data/User";
import { MixinDeclarations } from "@altea/altea/data/mixinDeclarations";
import { UserWithClaims } from "@altea/altea/data/security";
import { SimpleTaskSymbol } from "@altea/altea-scheduler/data/Scheduler";
import { AlertEntity, SendNotificationEmailTaskEntity } from "@altea/altea-alert/data/Alert";
import {
    EmailSenderConfigurationEntity, SmtpEmailServiceEntity,
} from "@altea/altea-email/data/EmailSenderConfiguration";
import {
    EmailReceptionConfigurationEntity, EmailReceptionMixin,
} from "@altea/altea-email/data/EmailReception";
import { EmailMessagePackageMixin } from "@altea/altea-email/data/EmailPackage";
import { ExchangeWebServiceEmailServiceEntity } from "@altea/altea-mailing-exchange/data/MailingExchangeWS";
import { MicrosoftGraphEmailServiceEntity } from "@altea/altea-mailing-microsoft-graph/data/MailingMicrosoftGraph";
import { Pop3EmailReceptionServiceEntity } from "@altea/altea-mailing-pop3/data/MailingPop3";
import { ProcessSchedulerBridgeOverrides } from "@altea/altea-processes/data/ProcessSchedulerBridge";
import { DashboardEntity_Part } from "@altea/altea-dashboard/data/Dashboard";
import {
    TextPartEntity, ImagePartEntity, SeparatorPartEntity, HealthCheckPartEntity, CustomPartEntity, ToolbarMenuPartEntity,
} from "@altea/altea-dashboard/data/Parts";
import {
    UserQueryPartEntity, ValueUserQueryListPartEntity, BigValuePartEntity,
} from "@altea/altea-user-queries/data/DashboardParts";
import { UserChartPartEntity, CombinedUserChartPartEntity } from "@altea/altea-chart/data/DashboardParts";
import { UserQueryEntity } from "@altea/altea-user-queries/data/UserQuery";
import { UserChartEntity } from "@altea/altea-chart/data/UserChart";
import { DashboardEntity } from "@altea/altea-dashboard/data/Dashboard";
import { CachedQueryEntity_UserAsset } from "@altea/altea-dashboard/data/CachedQuery";
import { QueryEntity } from "@altea/altea/data/queryEntity";
import { PermissionSymbol } from "@altea/altea-auth/data/Rules";
import { WorkflowEntity } from "@altea/altea-workflow/data/Workflow";
import {
    ToolbarElementBaseEntity, ToolbarEntity, ToolbarMenuEntity, ToolbarSwitcherEntity,
} from "@altea/altea-toolbar/data/Toolbar";
import { DiffLogMixin } from "@altea/altea-diff-log/data/DiffLog";
import { DynamicIsolationMixin } from "@altea/altea-dynamic/data/DynamicIsolation";
import { VisualTipConsumedEntity } from "@altea/altea/data/visualTip";
import { ChangeLogViewLogEntity } from "@altea/altea/data/changeLog";
import { SystemEventLogEntity } from "@altea/altea/data/systemEventLog";
import { PredictorEntity } from "@altea/altea-machine-learning/data/Predictor";
import { NeuralNetworkSettingsEntity } from "@altea/altea-machine-learning/data/NeuralNetworkSettings";
import { CaseActivityMixin } from "@altea/altea-workflow/data/CaseActivity";
import { EmailMessageEntity } from "@altea/altea-email/data/EmailMessage";
import { NoteEntity } from "@altea/altea-notes/data/Notes";
import { UserEmployeeMixin } from "./globals/UserEmployeeMixin.data";

export namespace EntityOverrides {
    /**
     * @param options.southwindOnly  Declare only what SOUTHWIND declares. An `implementedBy` list decides both what
     *   the editor offers and which TABLES the schema creates, so a few of these lists are the difference
     *   between a Southwind-shaped database and this one — see the marked entries. Set from LegacyMode by
     *   the Starter, and by the client from `/api/eastwind/appMode` (this runs on both tiers).
     */
    export function start(options?: { southwindOnly?: boolean }): void {
        const southwindOnly = options?.southwindOnly === true;

        // The two symbol containers this app renamed when it was ported. A symbol's KEY is
        // `<Container>.<Member>` and it is the `key` column of that symbol's table, so against a
        // Southwind database `EastwindTypeCondition.UserEntities` reads as a symbol that does not
        // exist and `SouthwindTypeCondition.UserEntities` as one that is gone — a rename the sync
        // offers per symbol, whose wrong answer DELETEs the row and re-inserts it with a new id,
        // orphaning every auth rule that points at it.
        //
        // Here rather than in the Starter because BOTH TIERS must agree: the key is model identity,
        // and a client still saying Eastwind* could not be handed the symbol's id by the metadata
        // blob, so every `toLite()` on it would throw. This module is the one place that runs first
        // on both, which is the same reason the mixins below live here.
        if (southwindOnly) {
            renameSymbolContainer(EastwindTypeCondition, "SouthwindTypeCondition");
            renameSymbolContainer(EastwindAgentUseCases, "SouthwindAgentUseCases");

            // @altea/altea-office-template renamed Signum.Word's Word* to Office* — the TYPES (whose clean name
            // is a query key and a basics.type row) and the symbol containers alike. That mapping is the
            // MODULE's own knowledge, so it owns the call; this app only knows which database it is on.
            useLegacyWordNames();

            // And a stored PROPERTY ROUTE is spelled Signum's way — PascalCase members. altea's member
            // is the TypeScript field name, so `basics.property_route.path` held `id` where a Signum
            // database holds `Id`, and every stored route read as a different one.
            setLegacyPropertyPaths(true);
        }

        // The reception mixin on EmailMessageEntity (asserted by EmailReceptionLogic.start): what makes a
        // RECEIVED message carry its server uid, its raw MIME and its reception row. Declaring it adds those
        // columns to the EmailMessage table — and, through that reference, pulls the whole reception schema
        // in — so it belongs here, on both tiers, before any (de)serialization.
        // NOT IN SOUTHWIND: its Starter.cs registers four mixins and this is not one of them.
        if (!southwindOnly)
            EmailReceptionMixin.declare();

        // The package mixin on EmailMessageEntity (Signum's `MixinDeclarations.Register<EmailMessageEntity,
        // EmailMessagePackageMixin>()`, asserted by EmailPackageLogic.start): which batch a message belongs to.
        // Declaring it adds the `package_id` column to the EmailMessage table, so it belongs here too.
        EmailMessagePackageMixin.declare();

        // The diff mixin on OperationLogEntity (Signum's MixinDeclarations.Register<OperationLogEntity,
        // DiffLogMixin>() in Southwind's Starter.cs, asserted by DiffLogLogic.start): the two dumps an
        // operation brackets. Declaring it adds those columns to the OperationLog table, so it belongs
        // here — both tiers, before any (de)serialization.
        DiffLogMixin.declare();

        // The file mixin on BigStringEmbedded (Signum's
        // `MixinDeclarations.Register<BigStringEmbedded, BigStringMixin>()`, which Southwind also calls
        // from its Starter): it is what lets a BigString route keep its text in a file instead of the
        // row. Which routes do, and where, is Starter.configureBigString. Both tiers, because the
        // declaration is what tells the serializer the `file` member exists.
        BigStringMixin.declare();

        // The isolation mixin on DynamicTypeEntity (Signum's
        // `MixinDeclarations.Register<DynamicTypeEntity, DynamicIsolationMixin>()`, which its APP calls
        // too — nothing in Signum.Dynamic does): which isolation strategy a dynamically defined type uses,
        // which @altea/altea-dynamic then generates an `Isolation.register` call from.
        //
        // eastwind declares it to EXERCISE the feature, not because eastwind is multi-tenant: it never
        // calls `IsolationLogic.start`, and that is where the app-wide assertion lives ("every table must
        // declare a strategy"). Declaring the mixin adds one column to `dynamic_type`; marking a dynamic
        // type Isolated then adds an `isolation` column to THAT type's table.
        //
        // Not in Southwind — see southwindOnly. It declares no isolation mixin, so `dynamic_type` has no
        // `isolation_strategy` column there.
        if (!southwindOnly)
            DynamicIsolationMixin.declare();

        // VisualTipConsumedEntity.user — core declares no implementations so it needn't reference
        // altea-auth (the same accommodation ExceptionEntity.user and OperationLogEntity.user make).
        overrideImplementedBy(VisualTipConsumedEntity, v => v.user, () => [UserEntity]);
        overrideImplementedBy(SystemEventLogEntity, s => s.user, () => [UserEntity]);
        overrideImplementedBy(ChangeLogViewLogEntity, c => c.user, () => [UserEntity]);

        // The three directory configurations are EMBEDDEDs on ApplicationConfigurationEntity (as in
        // Signum), so each one's roleMapping rows belong to THIS entity — an embedded is flattened onto
        // its owner's row and has no id to point at. The row types live in framework packages, which must
        // not name an app type, so each declares an empty @implementedBy the app widens here. It must
        // resolve to exactly one owner, which SchemaBuilder verifies; in legacy mode the column is
        // Signum's ParentID.
        overrideImplementedBy(AzureADRoleMappingEntity, a => a.configuration, () => [ApplicationConfigurationEntity]);
        overrideImplementedBy(OpenIDRoleMappingEntity, o => o.configuration, () => [ApplicationConfigurationEntity]);
        overrideImplementedBy(WindowsADRoleMappingEntity, w => w.configuration, () => [ApplicationConfigurationEntity]);

        // An email template's ATTACHMENT kinds. The LIST is what decides the row's columns — one FK per
        // implementation — so it belongs to the model rather than to module registration: Southwind offers
        // ImageAttachment alone, and its `email_template_attachments` carries that one column, NOT NULL
        // because a single implementation is not polymorphic. altea-email's own list adds
        // FileTokenAttachment, and @altea/altea-office-template widens it to three when its attachment half
        // starts (which is off in legacy mode — see OfficeTemplateLogic's `attachments`).
        if (southwindOnly)
            overrideImplementedBy(EmailTemplateEntity_Attachment, a => a.attachment, () => [ImageAttachmentEntity]);

        // ProcessEntity.data / ProcessExceptionLineEntity.line — Signum types both against an INTERFACE
        // (IProcessDataEntity / IEntity) and its schema builder gives one column per implementor in the
        // schema; altea has no runtime interface, so the app names the implementors its modules install.
        // Exactly Southwind's five, because altea-printing (whose PrintPackage is NOT process data here)
        // is the only extra process module eastwind starts.
        overrideImplementedBy(ProcessEntity, p => p.data, () => [
            PackageEntity,
            PackageOperationEntity,
            EmailPackageEntity,
            AutoconfigureNeuralNetworkEntity,
            PredictorEntity,
        ]);
        overrideImplementedBy(ProcessExceptionLineEntity, l => l.line, () => [PackageLineEntity]);

        // PredictorEntity.user — same accommodation as the log entities above.
        overrideImplementedBy(PredictorEntity, p => p.user, () => [UserEntity]);

        // PredictorEntity.algorithmSettings — @altea/altea-machine-learning declares
        // `IPredictorAlgorithmSettings` as an INTERFACE with an empty @implementedBy, so the app names the
        // concrete settings types it installs. Exactly the shape the mail services use, and for the same
        // reason: a module cannot know which algorithms an application ships.
        //
        // This is also what brings NeuralNetworkSettingsEntity (and its hidden-layer rows) into the
        // schema — without it the module's own algorithm has no table for its settings.
        overrideImplementedBy(PredictorEntity, p => p.algorithmSettings, () => [NeuralNetworkSettingsEntity]);

        // The workflow mixin on EmailMessageEntity (Signum's
        // `MixinDeclarations.Register<EmailMessageEntity, CaseActivityMixin>()`): an email produced INSIDE a
        // case activity carries the activity it came from, so a message can be traced back to its step. Both
        // tiers, because the client needs the PropertyRoute for the read-only line WorkflowClient adds; the
        // SERVER also asks for the stamping (`sb.include(EmailMessageEntity).withCaseActivityMixin()` in
        // eastwindWorkflow.server.ts), which is the half that fills it.
        //
        // Not in Southwind — see southwindOnly. Signum's own CaseActivityLogic only reacts to the mixin
        // (`MixinDeclarations.IsDeclared(typeof(EmailMessageEntity), typeof(CaseActivityMixin))`) and never
        // declares it, and Southwind's Starter does not either — so `email_message` has no
        // `case_activity_id` column there.
        if (!southwindOnly)
            CaseActivityMixin.declareOn(EmailMessageEntity);

        // The employee behind a login — Southwind writes exactly this in its Starter.cs. Declaring it adds
        // `employee_id` to the User table, so it belongs here: both tiers, before any (de)serialization.
        MixinDeclarations.register(UserEntity, UserEmployeeMixin);

        // …and the CLAIM that goes with it (Southwind fills it in EmployeesLogic, i.e. server-only). Here it
        // is one data-layer filler for both tiers — the server runs it when a request's user is resolved,
        // the client when someone logs in — which is what makes `EmployeeEntity.current()` a single accessor
        // instead of a server one and a client one. It rides in the auth token from there (AuthTokenServer).
        // NOTE the client's copy is only as good as what the user entity carries: a role that may not READ
        // `employee` gets null there, while the server (which fills the claim from the row) still sees it.
        UserWithClaims.fillClaims.push((uwc, user) => {
            uwc.claims["Employee"] = (user as UserEntity).mixin(UserEmployeeMixin).employee ?? null;
        });

        // MixinDeclarations.register(EmployeeEntity, ColaboratorsMixin);
        // registerCustomLite(EmployeeEntity, EmployeeLite, e => EmployeeLite.create({ ... }), /*isDefault*/ true);

        // implementedBy overrides (Signum's OverrideAttributes): the framework's ExceptionEntity /
        // OperationLogEntity declare `user` with NO implementations (so altea core needn't reference
        // altea-auth); the app points them at its concrete UserEntity. Runs on both tiers before any
        // (de)serialization or schema build.
        // A ScheduledTask may point at a SimpleTaskSymbol (the scheduler's own kind) OR at a
        // ProcessAlgorithmSymbol (the scheduler → processes bridge: the entry creates and QUEUES a process
        // instead of running inline). An override REPLACES the declared list, so SimpleTaskSymbol is passed
        // back in explicitly. Both tiers run this, which is the point of it living here.
        // A ScheduledTask may also point at an EMAIL RECEPTION CONFIGURATION (altea-email makes it an
        // ITaskEntity, as Signum does): scheduling "poll THIS mailbox" needs no task symbol of its own.
        // …or at altea-alert's SendNotificationEmailTask ("mail everyone their pending alerts"), which
        // AlertNotificationLogic.start re-checks and fails on if it is missing here.
        //
        // Under southwindOnly the override is SKIPPED ENTIRELY, leaving the scheduler's own declared
        // `[SimpleTaskSymbol]`: Signum's ProcessAlgorithmSymbol is a plain Symbol and NOT an ITaskEntity —
        // the "a scheduled task can BE a process" bridge is altea's addition — so Signum's
        // `ScheduledTaskEntity.Task` stays single-implementation and its column is NOT NULL. The server
        // half is gated to match (ProcessSchedulerBridge.start in starter.server.ts).
        if (!southwindOnly)
            ProcessSchedulerBridgeOverrides.overrideTaskImplementations([
                SimpleTaskSymbol,
                EmailReceptionConfigurationEntity,
                SendNotificationEmailTaskEntity,
            ]);

        // How this app SENDS mail. altea-email declares only its own SMTP service, so the two extra sender
        // packages are added here (Signum's per-module `AssertImplementedBy`, which each module's
        // `Logic.start` re-checks and fails on if this list is missing it). The list decides both the pickable
        // service types in the editor and which service TABLES the schema creates.
        overrideImplementedBy(EmailSenderConfigurationEntity, e => e.service, () => [
            SmtpEmailServiceEntity,
            // NOT IN SOUTHWIND, whose list is exactly Smtp + MicrosoftGraph.
            ...(southwindOnly ? [] : [ExchangeWebServiceEmailServiceEntity]),
            MicrosoftGraphEmailServiceEntity,
        ]);

        // …and how it RECEIVES: POP3 is the one protocol ported (altea-email's reception half declares an
        // EMPTY implementedBy on purpose — it ships no protocol of its own).
        // NOT IN SOUTHWIND: it receives no mail, so it names no reception service (and the empty list
        // altea-email declares then creates no service table).
        if (!southwindOnly)
            overrideImplementedBy(EmailReceptionConfigurationEntity, e => e.service, () => [
                Pop3EmailReceptionServiceEntity,
            ]);

        overrideImplementedBy(ExceptionEntity, e => e.user, () => [UserEntity]);
        overrideImplementedBy(OperationLogEntity, o => o.user, () => [UserEntity]);
        overrideImplementedBy(RestLogEntity, r => r.user, () => [UserEntity]);
        overrideImplementedBy(ViewLogEntity, v => v.user, () => [UserEntity]);
        // Same shape in the MODULES whose user references Signum also declares `Lite<IUserEntity>`:
        // an alert names who raised it, who it is for and who attended it; a note names who wrote it.
        overrideImplementedBy(AlertEntity, a => a.createdBy, () => [UserEntity]);
        overrideImplementedBy(AlertEntity, a => a.recipient, () => [UserEntity]);
        overrideImplementedBy(AlertEntity, a => a.attendedBy, () => [UserEntity]);
        overrideImplementedBy(NoteEntity, n => n.createdBy, () => [UserEntity]);

        // Which user assets a dashboard SNAPSHOT can cover (Signum's `[ImplementedBy()]` empty list on
        // CachedQueryEntity.UserAssets, widened by the app): @altea/altea-dashboard cannot name them,
        // because altea-user-queries and altea-chart depend on IT.
        overrideImplementedBy(CachedQueryEntity_UserAsset, c => c.userAsset, () => [UserQueryEntity, UserChartEntity]);

        // The dashboard PART types this app offers (Southwind did exactly this in Starter.cs:
        // `FieldAttributes((DashboardEntity a) => a.Parts.First().Content).Replace(new ImplementedByAttribute(
        // …))`). The list decides both the pickable part types in the editor and which part TABLES the schema
        // creates — @altea/altea-dashboard declares only its own five, so the modules' parts are added here.
        overrideImplementedBy(DashboardEntity_Part, d => d.content, () => [
            // NOT IN SOUTHWIND, whose list is exactly the six user-asset parts below.
            ...(southwindOnly ? [] : [
                TextPartEntity,
                ImagePartEntity,
                SeparatorPartEntity,
                HealthCheckPartEntity,
                CustomPartEntity,
            ]),
            UserQueryPartEntity,
            ValueUserQueryListPartEntity,
            BigValuePartEntity,
            UserChartPartEntity,
            CombinedUserChartPartEntity,
            ToolbarMenuPartEntity,
        ]);

        // What a TOOLBAR ELEMENT may point at (Signum's `[ImplementedBy()]` empty list, widened by each
        // module's `AssertImplementedBy` from its own Logic.Start). The list decides the pickable content
        // types in the editor, the FK columns of both element tables, AND — in altea — which types get the
        // "delete the elements pointing at me" cascade (see ToolbarLogic.start). Declared on the ABSTRACT
        // base: both concrete element rows inherit that one field, so one call covers ToolbarEntity_Element
        // and ToolbarMenuEntity_Element.
        // (`overrideImplementedBy` asks for a concrete Type<T>; the base is abstract, which matters only to
        // the type-checker — the FieldInfo it mutates is the very one both element rows inherit.)
        overrideImplementedBy(ToolbarElementBaseEntity, t => t.content, () => [
            QueryEntity,
            PermissionSymbol,
            ToolbarEntity,
            ToolbarMenuEntity,
            ToolbarSwitcherEntity,
            UserQueryEntity,
            UserChartEntity,
            DashboardEntity,
            // Signum's Starter.cs adds WorkflowEntity to both toolbar implementedBy lists: a toolbar element
            // pointing at a workflow STARTS a case of it (WorkflowToolbarConfig), and the whole workflow menu
            // rides on one PermissionSymbol element (WorkflowToolbarMenuConfig, already covered above).
            WorkflowEntity,
        ]);

        // Package / folder defaults (Signum's assembly [DefaultAssemblyCulture] + default schema). Written
        // as bare calls that the quote-transformer stamps with the file's __fileInfo, so they know the
        // package + directory they were declared in:
        //   setDefaultCulture("en");           // the language this package's code-declared strings are in
        //   setDefaultDatabaseSchema("dbo");   // the schema this folder's tables land in (server-only)
        // `setDefaultCulture` is package-wide; `setDefaultDatabaseSchema` is FOLDER-scoped — put one at the
        // top of a sub-folder's module (e.g. entities/sales/…) to override the package default for just
        // that folder, and the most specific directory wins.
    }
}
