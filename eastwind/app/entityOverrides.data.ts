import { overrideImplementedBy } from "@altea/altea/data/decorators";
import { getOrCreateTypeInfo, renameSymbolContainer, setLegacyMode } from "@altea/altea/data/reflection";
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
import { BigStringEmbedded } from "@altea/altea/data/bigString";
import { UserEntity } from "@altea/altea-auth/data/User";
import { MixinDeclarations } from "@altea/altea/data/mixinDeclarations";
import { UserWithClaims } from "@altea/altea/data/security";
import { SimpleTaskSymbol, ScheduledTaskEntity, ScheduledTaskLogEntity } from "@altea/altea-scheduler/data/Scheduler";
import { AlertEntity, SendNotificationEmailTaskEntity } from "@altea/altea-alert/data/Alert";
import { EmailSenderConfigurationEntity, SmtpEmailServiceEntity } from "@altea/altea-email/data/EmailSenderConfiguration";
import { EmailReceptionConfigurationEntity, EmailReceptionMixin } from "@altea/altea-email/data/EmailReception";
import { EmailMessagePackageMixin } from "@altea/altea-email/data/EmailPackage";
import { ExchangeWebServiceEmailServiceEntity } from "@altea/altea-mailing-exchange/data/MailingExchangeWS";
import { MicrosoftGraphEmailServiceEntity } from "@altea/altea-mailing-microsoft-graph/data/MailingMicrosoftGraph";
import { Pop3EmailReceptionServiceEntity } from "@altea/altea-mailing-pop3/data/MailingPop3";
import { ProcessSchedulerBridgeOverrides } from "@altea/altea-processes/data/ProcessSchedulerBridge";
import { DashboardEntity_Part } from "@altea/altea-dashboard/data/Dashboard";
import { TextPartEntity, ImagePartEntity, SeparatorPartEntity, HealthCheckPartEntity, CustomPartEntity, ToolbarMenuPartEntity } from "@altea/altea-dashboard/data/Parts";
import { UserQueryPartEntity, ValueUserQueryListPartEntity, BigValuePartEntity } from "@altea/altea-user-queries/data/DashboardParts";
import { UserChartPartEntity, CombinedUserChartPartEntity } from "@altea/altea-chart/data/DashboardParts";
import { UserQueryEntity } from "@altea/altea-user-queries/data/UserQuery";
import { UserChartEntity } from "@altea/altea-chart/data/UserChart";
import { DashboardEntity } from "@altea/altea-dashboard/data/Dashboard";
import { CachedQueryEntity_UserAsset } from "@altea/altea-dashboard/data/CachedQuery";
import { QueryEntity } from "@altea/altea/data/queryEntity";
import { PermissionSymbol } from "@altea/altea/data/permissionSymbol";
import { WorkflowEntity } from "@altea/altea-workflow/data/Workflow";
import { CaseTagEntity } from "@altea/altea-workflow/data/Case";
import { DynamicSqlMigrationEntity } from "@altea/altea-dynamic/data/DynamicSqlMigration";
import { ToolbarElementBaseEntity, ToolbarEntity, ToolbarMenuEntity, ToolbarSwitcherEntity } from "@altea/altea-toolbar/data/Toolbar";
import { DiffLogMixin } from "@altea/altea-diff-log/data/DiffLog";
import { DynamicIsolationMixin } from "@altea/altea-dynamic/data/DynamicIsolation";
import { DynamicTypeEntity } from "@altea/altea-dynamic/data/DynamicType";
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
    export function start(options?: { legacyMode?: boolean }): void {
        const legacyMode = options?.legacyMode === true;

        if (legacyMode) {
            setLegacyMode(true);
            renameSymbolContainer(EastwindTypeCondition, "SouthwindTypeCondition");
            renameSymbolContainer(EastwindAgentUseCases, "SouthwindAgentUseCases");
            useLegacyWordNames();
            setLegacyPropertyPaths(true);
        }//LegacySymbolNames

        if (!legacyMode)
            MixinDeclarations.register(EmailMessageEntity, EmailReceptionMixin);
        MixinDeclarations.register(EmailMessageEntity, EmailMessagePackageMixin);
        MixinDeclarations.register(OperationLogEntity, DiffLogMixin);
        MixinDeclarations.register(BigStringEmbedded, BigStringMixin);
        if (!legacyMode)
            MixinDeclarations.register(DynamicTypeEntity, DynamicIsolationMixin);
        if (!legacyMode)
            MixinDeclarations.register(EmailMessageEntity, CaseActivityMixin);
        MixinDeclarations.register(UserEntity, UserEmployeeMixin);

        UserWithClaims.fillClaims.push((uwc, user) => {
            uwc.claims["Employee"] = (user as UserEntity).mixin(UserEmployeeMixin).employee ?? null;
        });

        overrideImplementedBy(VisualTipConsumedEntity, v => v.user, () => [UserEntity]);
        overrideImplementedBy(SystemEventLogEntity, s => s.user, () => [UserEntity]);
        overrideImplementedBy(ChangeLogViewLogEntity, c => c.user, () => [UserEntity]);

        overrideImplementedBy(AzureADRoleMappingEntity, a => a.configuration, () => [ApplicationConfigurationEntity]);
        overrideImplementedBy(OpenIDRoleMappingEntity, o => o.configuration, () => [ApplicationConfigurationEntity]);
        overrideImplementedBy(WindowsADRoleMappingEntity, w => w.configuration, () => [ApplicationConfigurationEntity]);

        if (legacyMode)//LegacyEmailAttachments
            overrideImplementedBy(EmailTemplateEntity_Attachment, a => a.attachment, () => [ImageAttachmentEntity]);

        overrideImplementedBy(ProcessEntity, p => p.data, () => [
            PackageEntity,
            PackageOperationEntity,
            EmailPackageEntity,
            AutoconfigureNeuralNetworkEntity,
            PredictorEntity,
        ]);
        overrideImplementedBy(ProcessExceptionLineEntity, l => l.line, () => [PackageLineEntity]);

        overrideImplementedBy(PredictorEntity, p => p.user, () => [UserEntity]);
        overrideImplementedBy(PredictorEntity, p => p.algorithmSettings, () => [NeuralNetworkSettingsEntity]);

        if (!legacyMode)
            ProcessSchedulerBridgeOverrides.overrideTaskImplementations([
                SimpleTaskSymbol,
                EmailReceptionConfigurationEntity,
                SendNotificationEmailTaskEntity,
            ]);

        overrideImplementedBy(EmailSenderConfigurationEntity, e => e.service, () => [
            SmtpEmailServiceEntity,
            ...(legacyMode ? [] : [ExchangeWebServiceEmailServiceEntity]),
            MicrosoftGraphEmailServiceEntity,
        ]);

        if (!legacyMode)
            overrideImplementedBy(EmailReceptionConfigurationEntity, e => e.service, () => [
                Pop3EmailReceptionServiceEntity,
            ]);

        overrideImplementedBy(ExceptionEntity, e => e.user, () => [UserEntity]);
        overrideImplementedBy(OperationLogEntity, o => o.user, () => [UserEntity]);
        overrideImplementedBy(RestLogEntity, r => r.user, () => [UserEntity]);
        overrideImplementedBy(ViewLogEntity, v => v.user, () => [UserEntity]);
        overrideImplementedBy(AlertEntity, a => a.createdBy, () => [UserEntity]);
        overrideImplementedBy(AlertEntity, a => a.recipient, () => [UserEntity]);
        overrideImplementedBy(AlertEntity, a => a.attendedBy, () => [UserEntity]);
        overrideImplementedBy(NoteEntity, n => n.createdBy, () => [UserEntity]);
        overrideImplementedBy(DynamicSqlMigrationEntity, d => d.createdBy, () => [UserEntity]);
        overrideImplementedBy(DynamicSqlMigrationEntity, d => d.executedBy, () => [UserEntity]);
        overrideImplementedBy(ProcessEntity, p => p.user, () => [UserEntity]);
        overrideImplementedBy(ScheduledTaskEntity, s => s.user, () => [UserEntity]);
        overrideImplementedBy(ScheduledTaskLogEntity, s => s.user, () => [UserEntity]);
        overrideImplementedBy(CaseTagEntity, c => c.createdBy, () => [UserEntity]);

        overrideImplementedBy(CachedQueryEntity_UserAsset, c => c.userAsset, () => [UserQueryEntity, UserChartEntity]);

        overrideImplementedBy(DashboardEntity_Part, d => d.content, () => [
            ...(legacyMode ? [] : [
                TextPartEntity,
                ImagePartEntity,
                SeparatorPartEntity,
                HealthCheckPartEntity,
                CustomPartEntity,
            ]),//LegacyOnlyParts
            UserQueryPartEntity,
            ValueUserQueryListPartEntity,
            BigValuePartEntity,
            UserChartPartEntity,
            CombinedUserChartPartEntity,
            ToolbarMenuPartEntity,
        ]);

        overrideImplementedBy(ToolbarElementBaseEntity, t => t.content, () => [
            QueryEntity,
            PermissionSymbol,
            ToolbarEntity,
            ToolbarMenuEntity,
            ToolbarSwitcherEntity,
            UserQueryEntity,
            UserChartEntity,
            DashboardEntity,
            WorkflowEntity,
        ]);
    }
}
