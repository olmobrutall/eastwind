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
// Empty today: eastwind registers no mixins, every lite model is the default, and implementedBy is
// declared inline via @implementedBy on OrderEntity.customer. As those needs arise, register them here.
import { overrideImplementedBy } from "@altea/altea/data/decorators";
import type { Entity, Type } from "@altea/altea/data/entity";
import { ExceptionEntity } from "@altea/altea/data/exception";
import { OperationLogEntity } from "@altea/altea/data/operationLog";
import { UserEntity } from "@altea/altea-auth/data/User";
import { SimpleTaskSymbol } from "@altea/altea-scheduler/data/Scheduler";
import {
    EmailSenderConfigurationEntity, SmtpEmailServiceEntity,
} from "@altea/altea-email/data/EmailSenderConfiguration";
import {
    EmailReceptionConfigurationEntity, EmailReceptionMixin,
} from "@altea/altea-email/data/EmailReception";
import { ExchangeWebServiceEmailServiceEntity } from "@altea/altea-mailing-exchange/data/MailingExchangeWS";
import { MicrosoftGraphEmailServiceEntity } from "@altea/altea-mailing-microsoft-graph/data/MailingMicrosoftGraph";
import { Pop3EmailReceptionServiceEntity } from "@altea/altea-mailing-pop3/data/MailingPop3";
import { ProcessSchedulerBridgeOverrides } from "@altea/altea-processes/data/ProcessSchedulerBridge";
import { DashboardEntity_Part } from "@altea/altea-dashboard/data/Dashboard";
import {
    TextPartEntity, ImagePartEntity, SeparatorPartEntity, HealthCheckPartEntity, CustomPartEntity,
} from "@altea/altea-dashboard/data/Parts";
import {
    UserQueryPartEntity, ValueUserQueryListPartEntity, BigValuePartEntity,
} from "@altea/altea-user-queries/data/DashboardParts";
import { UserChartPartEntity, CombinedUserChartPartEntity } from "@altea/altea-chart/data/DashboardParts";
import { UserQueryEntity } from "@altea/altea-user-queries/data/UserQuery";
import { UserChartEntity } from "@altea/altea-chart/data/UserChart";
import { DashboardEntity } from "@altea/altea-dashboard/data/Dashboard";
import { QueryEntity } from "@altea/altea/data/queryEntity";
import { PermissionSymbol } from "@altea/altea-auth/data/Rules";
import {
    ToolbarElementBaseEntity, ToolbarEntity, ToolbarMenuEntity, ToolbarSwitcherEntity,
} from "@altea/altea-toolbar/data/Toolbar";
import { DiffLogMixin } from "@altea/altea-diff-log/data/DiffLog";

export namespace EntityOverrides {
    export function start(): void {
        // The reception mixin on EmailMessageEntity (Signum's `MixinDeclarations.Register<EmailMessageEntity,
        // EmailReceptionMixin>()` in Starter.cs, asserted by EmailReceptionLogic.start): what makes a RECEIVED
        // message carry its server uid, its raw MIME and its reception row. Declaring it adds those columns to
        // the EmailMessage table, so it belongs here — both tiers, before any (de)serialization.
        EmailReceptionMixin.declare();

        // The diff mixin on OperationLogEntity (Signum's MixinDeclarations.Register<OperationLogEntity,
        // DiffLogMixin>() in Southwind's Starter.cs, asserted by DiffLogLogic.start): the two dumps an
        // operation brackets. Declaring it adds those columns to the OperationLog table, so it belongs
        // here — both tiers, before any (de)serialization.
        DiffLogMixin.declare();

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
        ProcessSchedulerBridgeOverrides.overrideTaskImplementations([
            SimpleTaskSymbol as unknown as Type<Entity>,
            EmailReceptionConfigurationEntity as unknown as Type<Entity>,
        ]);

        // How this app SENDS mail. altea-email declares only its own SMTP service, so the two extra sender
        // packages are added here (Signum's per-module `AssertImplementedBy`, which each module's
        // `Logic.start` re-checks and fails on if this list is missing it). The list decides both the pickable
        // service types in the editor and which service TABLES the schema creates.
        overrideImplementedBy(EmailSenderConfigurationEntity, "service", () => [
            SmtpEmailServiceEntity,
            ExchangeWebServiceEmailServiceEntity,
            MicrosoftGraphEmailServiceEntity,
        ]);

        // …and how it RECEIVES: POP3 is the one protocol ported (altea-email's reception half declares an
        // EMPTY implementedBy on purpose — it ships no protocol of its own).
        overrideImplementedBy(EmailReceptionConfigurationEntity, "service", () => [
            Pop3EmailReceptionServiceEntity,
        ]);

        overrideImplementedBy(ExceptionEntity, "user", () => [UserEntity]);
        overrideImplementedBy(OperationLogEntity, "user", () => [UserEntity]);

        // The dashboard PART types this app offers (Southwind did exactly this in Starter.cs:
        // `FieldAttributes((DashboardEntity a) => a.Parts.First().Content).Replace(new ImplementedByAttribute(
        // …))`). The list decides both the pickable part types in the editor and which part TABLES the schema
        // creates — @altea/altea-dashboard declares only its own five, so the modules' parts are added here.
        overrideImplementedBy(DashboardEntity_Part, "content", () => [
            TextPartEntity,
            ImagePartEntity,
            SeparatorPartEntity,
            HealthCheckPartEntity,
            CustomPartEntity,
            UserQueryPartEntity,
            ValueUserQueryListPartEntity,
            BigValuePartEntity,
            UserChartPartEntity,
            CombinedUserChartPartEntity,
        ]);

        // What a TOOLBAR ELEMENT may point at (Signum's `[ImplementedBy()]` empty list, widened by each
        // module's `AssertImplementedBy` from its own Logic.Start). The list decides the pickable content
        // types in the editor, the FK columns of both element tables, AND — in altea — which types get the
        // "delete the elements pointing at me" cascade (see ToolbarLogic.start). Declared on the ABSTRACT
        // base: both concrete element rows inherit that one field, so one call covers ToolbarEntity_Element
        // and ToolbarMenuEntity_Element.
        // (`overrideImplementedBy` asks for a concrete Type<T>; the base is abstract, which matters only to
        // the type-checker — the FieldInfo it mutates is the very one both element rows inherit.)
        overrideImplementedBy(ToolbarElementBaseEntity as unknown as Type<ToolbarElementBaseEntity>, "content", () => [
            QueryEntity,
            PermissionSymbol,
            ToolbarEntity,
            ToolbarMenuEntity,
            ToolbarSwitcherEntity,
            UserQueryEntity,
            UserChartEntity,
            DashboardEntity,
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
