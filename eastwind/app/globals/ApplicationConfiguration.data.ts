import { Entity } from "@altea/altea/data/entity";
import { entity, quoted } from "@altea/altea/data/decorators";
import { init } from "@altea/altea/data/reflection";
import { stringLengthValidator } from "@altea/altea/data/validators";
import type { ExecuteSymbol } from "@altea/altea/data/operations";
import type { TypeConditionSymbol } from "@altea/altea-auth/data/Rules";
import { AgentSymbol } from "@altea/altea-agent/data/SkillCustomization";
import { EmailConfigurationEmbedded } from "@altea/altea-email/data/Email";
import { EmailSenderConfigurationEntity } from "@altea/altea-email/data/EmailSenderConfiguration";
import { ChatbotConfigurationEmbedded } from "@altea/altea-agent/data/LanguageModel";
import { WorkflowConfigurationEmbedded } from "@altea/altea-workflow/data/Workflow";
import { SMSConfigurationEmbedded } from "@altea/altea-sms/data/SMS";
import { TranslationConfigurationEmbedded } from "@altea/altea-translations/data/Translation";
import { AuthTokenConfigurationEmbedded } from "@altea/altea-auth/data/AuthToken";
import { FileTypeSymbol } from "@altea/altea-files/data/Files";
import { AzureADConfigurationEmbedded } from "@altea/altea-auth-azuread/data/AzureAD";
import { OpenIDConfigurationEmbedded } from "@altea/altea-auth-openid/data/OpenID";
import { WindowsADConfigurationEmbedded } from "@altea/altea-auth-windowsad/data/WindowsAD";

// ONE persisted row holding every module's settings, which each module's `Logic.start` reads through a
// lambda (`EmailLogic.start(sb, { getConfiguration: () => GlobalsLogic.configuration().email, … })`).
//
// Settings an administrator should be able to see and change are DATA, not deployment wiring, so they live
// here rather than in `EASTWIND_*` environment variables. What stays in the environment is what must be
// decided BEFORE a row can be read: the connection string, and the storage credentials / backend switch of
// `eastwindFileStores.server.ts`. A fresh database gets this row from CreateCulturesAndConfiguration with
// plain dev DEFAULTS (terminal/typeScriptMigrations.ts); from then on the row is the only source of truth.
//
// Two members are worth a note:
//  - there is no `Folders` member. A store's folder is derived from the store's own NAME
//    (`./files/<name>`, see eastwindFileStores.store), so the paths cannot drift from the code that names
//    the stores. WHICH backend holds the bytes stays in the environment as EASTWIND_FILE_STORE.
//  - `databaseName` is STORED but never read: the row is selected by `environment` instead — see both
//    fields.
/**
 * WHICH row this process runs as — `DB_ENVIRONMENT`, defaulting to "Development". An explicit environment
 * variable is what a deployment controls, so a restored copy of production can be pointed at its own row
 * without editing data. `GlobalsLogic.environment()` re-exports this, and the lazy selects the row with it.
 *
 * A module-level CONST for two reasons: `isActive` below is a @quoted expression, and the transformer
 * captures a free identifier by VALUE (it becomes a SQL parameter) — a `process.env[…]` read inside the
 * body would have no SQL translation. And it is read off `globalThis` rather than `process` directly
 * because this file is DATA, i.e. isomorphic: the same module is evaluated in the browser, which has no
 * `process` at all (and the data tsconfig ships no node types, by design).
 */
export const currentEnvironment: string =
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env?.["DB_ENVIRONMENT"] || "Development";

@entity("Main", "Master")
export class ApplicationConfigurationEntity extends Entity {

    /**
     * The row's IDENTITY: one row per environment, and `DB_ENVIRONMENT` names which one this process runs
     * as (see GlobalsLogic.environment).
     */
    @stringLengthValidator({ min: 3, max: 100 })
    environment: string;

    /**
     * The database this row describes. altea selects the row by `environment` (above) and its Connector
     * exposes no database name at all, so NOTHING reads this. It is declared anyway, because a LEGACY
     * database has the column and uses it as the row's identity — dropping it would lose what every such
     * deployment put there. The seed fills it from the connection string.
     */
    @stringLengthValidator({ min: 3, max: 100 })
    databaseName: string;

    /*Email*/
    email: EmailConfigurationEmbedded;

    /** The sender the mail modules deliver through, a REFERENCE: the row is edited on its own page and
     *  referenced here, so switching host is not a re-save of the whole configuration. */
    emailSender: EmailSenderConfigurationEntity;

    /*Agent*/
    chatbot: ChatbotConfigurationEmbedded;

    /*Sms*/
    sms: SMSConfigurationEmbedded;

    /*Workflow*/
    workflow: WorkflowConfigurationEmbedded;

    /*Translation — the machine translators' keys. Empty is normal: both answer "nothing to suggest". */
    translation: TranslationConfigurationEmbedded;

    /*Auth — how long a bearer token stays fresh. The KEY it is signed with is not here: it is needed to
      read the very first request, before any row can be loaded, so it stays in AUTH_TOKEN_KEY. */
    authTokens: AuthTokenConfigurationEmbedded;

    /*Auth — at most one directory owns the login flow; see eastwindAuthAD.server.ts */
    azureAD: AzureADConfigurationEmbedded | null;
    openID: OpenIDConfigurationEmbedded | null;
    windowsAD: WindowsADConfigurationEmbedded | null;

    /** Whether THIS row is the one this process runs on — the search page's answer to "which of these is
     *  live?". @quoted so it translates to SQL (`environment = @p`) and is therefore sortable / filterable,
     *  and so the same body answers in memory. Registered as a query expression in GlobalsLogic.start. */
    @quoted isActive(): boolean { return this.environment == currentEnvironment; }

    @quoted toString(): string { return this.environment; }
}

export namespace ApplicationConfigurationOperation {
    export const Save: ExecuteSymbol<ApplicationConfigurationEntity> = init();
}

// The app's own row-level condition symbols, referenced BOTH by the server (which registers the predicate
// for each entity type — see starter.server.ts) and by the auth-rules admin UI (which offers them per
// role).
//
// `UserEntities`  — the row belongs to the current USER (a personal dashboard / user query / user chart).
// `RoleEntities`  — the row is global (no owner) or owned by one of the current user's ROLES (shared).
// `CurrentEmployee` — the ORDER is handled by the employee behind the current login.
//
// A symbol only bites once a role has a condition RULE using it (seeded in terminal/typeScriptMigrations.ts for
// "Standard user", editable in the Role → Type rules UI).
export namespace EastwindTypeCondition {
    export const UserEntities: TypeConditionSymbol = init();
    export const RoleEntities: TypeConditionSymbol = init();
    /** The order is handled by the employee behind the current login. */
    export const CurrentEmployee: TypeConditionSymbol = init();
    /** A @altea/altea-whats-new item that is PUBLISHED — what an ordinary user may see of the news. */
    export const PublishedNews: TypeConditionSymbol = init();
}

// One store per log table whose BigString text lives in a FILE rather than in the row (see
// Starter.configureBigString). Separate symbols because they are separate stores: a deployment can put the
// exception dumps somewhere different from the e-mails.
export namespace BigStringFileType {
    export const Exceptions: FileTypeSymbol = init();
    export const OperationLog: FileTypeSymbol = init();
    export const ViewLog: FileTypeSymbol = init();
    export const EmailMessage: FileTypeSymbol = init();
    export const RestLog: FileTypeSymbol = init();
}

// The app's own agents, beyond the three @altea/altea-agent declares itself (Chatbot /
// QuestionSummarizer / ConversationSumarizer).
export namespace EastwindAgentUseCases {
    /** The tree exposed at /api/mcp — all sub-skills Lazy, so an external host discovers them one by one. */
    export const MCP: AgentSymbol = init();
}//EastwindAgentUseCases
