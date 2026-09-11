import "@altea/altea/server"; // installs save()/toLite()
import * as fs from "node:fs";
import { table } from "@altea/altea/server/table";
import { PasswordEncoding } from "@altea/altea/server/passwordEncoding";
import { Replacements } from "@altea/altea/server/sync/synchronizer";
import { Enum } from "@altea/altea/data/enum";
import { RoleEntity, RoleEntity_InheritsFrom, MergeStrategy } from "@altea/altea-auth/data/Role";
import { UserEntity, UserState } from "@altea/altea-auth/data/User";
import { AuthImportExport } from "@altea/altea-auth/server/AuthImportExport";
import { UserAssetsImporter, warmUserAssetCaches } from "@altea/altea-user-assets/server/UserAssetsImportExport";
import { EntityAction } from "@altea/altea-user-assets/data/UserAssets";
import { TypeScriptMigrationRunner } from "@altea/altea-migrations/server/TypeScriptMigrationRunner";
import { CultureInfoLogic } from "@altea/altea/server/cultureInfoLogic";
import { EmailConfigurationEmbedded } from "@altea/altea-email/data/Email";
import {
    EmailSenderConfigurationEntity, SmtpEmailServiceEntity, SmtpNetworkDeliveryEmbedded,
    SmtpDeliveryFormat, SmtpDeliveryMethod,
} from "@altea/altea-email/data/EmailSenderConfiguration";
import { ChatbotConfigurationEmbedded } from "@altea/altea-agent/data/LanguageModel";
import { WorkflowConfigurationEmbedded } from "@altea/altea-workflow/data/Workflow";
import { ApplicationConfigurationEntity, currentEnvironment } from "../globals/ApplicationConfiguration.data";
import { EmployeeLoader } from "./northwind/employeeLoader";
import { DepartmentLoader } from "./northwind/departmentLoader";
import { SMSConfigurationEmbedded } from "@altea/altea-sms/data/SMS";
import { ProductLoader } from "./northwind/productLoader";
import { CustomerLoader } from "./northwind/customerLoader";
import { OrderLoader } from "./northwind/orderLoader";
import { NorthwindSeed } from "./northwind/northwindSeed";
import { terminalFile } from "./terminalFile";

// Port of Southwind.Terminal/SouthwindMigrations.cs — the app's CODE MIGRATIONS: the ordered list of
// TypeScript steps that bring a fresh database to a usable state, each recorded in
// TypeScriptMigrationEntity — `CSharpMigration` against a Signum database — so it runs ONCE per database
// (Southwind's `new CSharpMigrationRunner { … }.Run(autoRun)`).
//
// This is NOT the terminal's "Load" menu: that one (Southwind's `Program.Load`) is a bag of RE-RUNNABLE
// ad-hoc tools, logged to LoadMethodLog but never recorded as migrations — see terminal.ts.
//
// The individual steps mirror Southwind's:
//   • createCulturesAndConfiguration — CreateCulturesAndConfiguration: the supported cultures + THE
//                         ApplicationConfiguration row every module's settings live on.
//   • createRoles       — CreateRoles (AuthLogic.LoadRoles): Anonymous, Standard user, Super user
//                         (Intersection), Advanced user ⊃ Standard.
//   • createSystemUser  — CreateSystemUser: the "System" (Super user) + "Anonymous" users.
//   • the Northwind loaders — EmployeeLoader / ProductLoader / CustomerLoader / OrderLoader, in dependency
//                         order (Southwind lists them in exactly this order).
//   • importUserAssets  — ImportToolbar (UserAssetsImporter.Preview + Import over terminal/UserAssets.xml).
//   • importAuthRules   — InitialAuthRulesImport (AuthLogic.AutomaticImportAuthRules over
//                         terminal/AuthRules.xml). LAST, as in Southwind: the rules reference the types,
//                         users and assets everything above created.
//
// Not ported (Southwind steps whose module does not exist here): SimulateOrderSystemTime,
// ImportWordReportTemplateForOrder, ImportInstanceTranslations, ImportPredictor.
// Passwords equal the username (Southwind's HashPassword(name, name)) — dev only. Every step is idempotent
// on its own, so re-running one after deleting its TypeScriptMigration row is safe.
export namespace TypeScriptMigrations {

    /** Southwind's `SouthwindMigrations.CSharpMigrations(autoRun)` — the terminal's `ts` command. */
    export async function run(autoRun: boolean): Promise<void> {
        const runner = new TypeScriptMigrationRunner();

        // The unique names are the MIGRATION IDENTITY in the database (renaming one re-runs it), so they are
        // the C# method names Southwind used rather than the console captions.
        // FIRST: every Load* step below reads the Northwind SOURCE database through the `Nw*` views, and
        // Southwind simply assumes it is there (the SQL Server sample everyone had installed). eastwind ships
        // the vendor script for both dialects and seeds it, so `ts` is self-contained on a fresh machine.
        runner.add("CreateCulturesAndConfiguration", () => createCulturesAndConfiguration());
        runner.add("CreateRoles", () => createRoles());
        runner.add("CreateSystemUser", () => createSystemUser());
        runner.add("LoadRegions", () => EmployeeLoader.loadRegions());
        runner.add("LoadTerritories", () => EmployeeLoader.loadTerritories());
        runner.add("LoadEmployees", () => EmployeeLoader.loadEmployees());
        runner.add("LoadSuppliers", () => ProductLoader.loadSuppliers());
        runner.add("LoadCategories", () => ProductLoader.loadCategories());
        runner.add("LoadProducts", () => ProductLoader.loadProducts());
        runner.add("LoadCompanies", () => CustomerLoader.loadCompanies());
        runner.add("LoadPersons", () => CustomerLoader.loadPersons());
        runner.add("LoadShippers", () => OrderLoader.loadShippers());
        runner.add("LoadOrders", () => OrderLoader.loadOrders());
        runner.add("CreateUsers", () => EmployeeLoader.createUsers());
        // altea addition — no Southwind counterpart: its CreateUsers has always set the UserEmployeeMixin,
        // while eastwind's did not exist until the mixin was ported. Re-running the same idempotent step
        // under a new name links the users a database seeded before then already has; on a fresh database
        // CreateUsers has just done it and this is a no-op.
        runner.add("LinkUsersToEmployees", () => EmployeeLoader.createUsers());
        runner.add("LoadEmployeePassages", () => EmployeeLoader.loadEmployeePassages());
        runner.add("LoadDepartments", () => DepartmentLoader.loadDepartments());
        runner.add("ImportUserAssets", () => importUserAssets());
        runner.add("ImportAuthRules", () => importAuthRules());

        await runner.run(autoRun);
    }

    /**
     * Southwind's `CreateCulturesAndConfiguration`: the cultures eastwind ships translations for, and the
     * ONE ApplicationConfiguration row for this environment — what every module's configuration lambda reads
     * (see globals/GlobalsLogic.server.ts). Idempotent: an existing row for this environment is left alone.
     *
     * The initial VALUES are plain DEFAULTS for a dev machine, as Southwind's literals are — not environment
     * reads: the row is the source of truth from the first run, and what a deployment must decide BEFORE a
     * row can be read stays in the environment (see .env.example). Every credential — the chatbot provider
     * keys, the three DIRECTORY members — is seeded empty / null, exactly as Southwind seeds `AzureAD = null`:
     * those are configured on the page, not by redeploying.
     */
    export async function createCulturesAndConfiguration(): Promise<void> {
        await CultureInfoLogic.ensureCultures(["en", "es", "de"]);
        const english = CultureInfoLogic.getCulture("en");

        const existing = await table(ApplicationConfigurationEntity)
            .filter(a => a.environment == currentEnvironment).singleOrNull();
        if (existing != null) {
            console.log(`[configuration] '${currentEnvironment}' already exists`);
            return;
        }

        // Southwind seeds a localhost SMTP sender so the mail module has somewhere to point; with
        // `sendEmails` false nothing actually leaves the process.
        const sender = EmailSenderConfigurationEntity.create({
            name: "localhost",
            service: SmtpEmailServiceEntity.create({
                deliveryFormat: SmtpDeliveryFormat.SevenBit,
                deliveryMethod: SmtpDeliveryMethod.Network,
                network: SmtpNetworkDeliveryEmbedded.create({ host: "localhost" }),
            }),
        });
        await sender.save();

        await ApplicationConfigurationEntity.create({
            environment: currentEnvironment,
            databaseName: databaseNameOf(process.env["EASTWIND_DB"]),
            email: EmailConfigurationEmbedded.create({
                defaultCulture: english,
                urlLeft: "http://localhost:5173",
                sendEmails: false,
                // The inbound half. Off for the same reason as `sendEmails`: a dev database should not touch
                // a real mailbox — and with it false a poll FAILS LOUDLY rather than doing nothing.
                reciveEmails: false,
                avoidSendingEmailsOlderThan: null,
            }),
            emailSender: sender,
            // Every provider key is left EMPTY: a key is a credential, and the Chatbot tab is where one is
            // pasted (Southwind seeds none either).
            chatbot: ChatbotConfigurationEmbedded.create({}),
            workflow: WorkflowConfigurationEmbedded.create({
                avoidExecutingScriptsOlderThan: null,
            }),
            sms: SMSConfigurationEmbedded.create({
                // One of the cultures seeded just above (en / es / de); Southwind uses en-GB, which is
                // not in eastwind's set.
                defaultCulture: english,
            }),
            azureAD: null,
            openID: null,
            windowsAD: null,
        }).save();

        console.log(`[configuration] created '${currentEnvironment}'`);
    }

    export async function createRoles(): Promise<void> {
        await ensureRole("Anonymous", MergeStrategy.Union, []);
        const standard = await ensureRole("Standard user", MergeStrategy.Union, []);
        await ensureRole("Super user", MergeStrategy.Intersection, []);
        await ensureRole("Advanced user", MergeStrategy.Union, [standard]);
    }

    export async function createSystemUser(): Promise<void> {
        await ensureUser("System", "Super user");
        await ensureUser("Anonymous", "Anonymous");
    }

    // ---- the XML seeds (Southwind's InitialAuthRulesImport / ImportToolbar) -----------------------------

    /**
     * Southwind's `InitialAuthRulesImport` → `AuthLogic.AutomaticImportAuthRules`: apply terminal/
     * AuthRules.xml. Renames are asked on a real console; headless (no TTY) treats every ambiguous rename as
     * no-rename (drop), logged.
     */
    export async function importAuthRules(file?: string): Promise<void> {
        const fileName = file ?? seedFile("AuthRules.xml");
        const xml = fs.readFileSync(fileName, "utf8");

        const replacements = new Replacements();
        replacements.interactive = Boolean(process.stdin.isTTY);
        if (!replacements.interactive)
            replacements.autoReplacement = ({ oldValue }) => {
                console.log(`[import-auth] no-rename (drop): '${oldValue}'`);
                return { oldValue, newValue: null };
            };

        const result = await AuthImportExport.importAuthRules(xml, replacements);
        console.log(`[import-auth] applied roles: ${result.appliedRoles.join(", ") || "(none)"}`);
        if (result.renames.length > 0)
            console.log(`[import-auth] renames: ${result.renames.map(r => `${r.key.replace("AuthRules:", "")} ${r.from}→${r.to}`).join(", ")}`);
        if (result.skippedRoles.length > 0)
            console.log(`[import-auth] SKIPPED (no DB role after rename): ${result.skippedRoles.join(", ")}`);
        console.log(`[import-auth] done (${fileName})`);
    }

    /** The export half of Southwind's `AuthLogic.ImportExportAuthRules` menu entry. */
    export async function exportAuthRules(file?: string): Promise<void> {
        const fileName = file ?? "AuthRules.xml";
        fs.writeFileSync(fileName, await AuthImportExport.exportAuthRules(), "utf8");
        console.log(`[export-auth] wrote ${fileName}`);
    }

    /**
     * Southwind's `ImportToolbar`: UserAssetsImporter.Preview over terminal/UserAssets.xml, then Import with
     * that preview. The preview defaults every EXISTING asset to override (matched by guid), which is what a
     * re-run of the seed should do; `keepExisting` flips that so only new assets are created.
     */
    export async function importUserAssets(file?: string, keepExisting = false): Promise<void> {
        const fileName = file ?? seedFile("UserAssets.xml");
        const xml = fs.readFileSync(fileName, "utf8");

        await warmUserAssetCaches(); // the query / type lookups the (de)serializers resolve against
        const model = await UserAssetsImporter.preview(xml);
        if (keepExisting)
            model.lines.forEach(l => l.overrideEntity = false);

        for (const l of model.lines)
            console.log(`  ${Enum.toName(EntityAction, l.action).padEnd(9)} ${String(l.type).padEnd(12)} ${l.text}`
                + (l.action !== EntityAction.New ? (l.overrideEntity ? " (override)" : " (kept)") : ""));

        await UserAssetsImporter.importAssets(xml, model);
        console.log(`[import-assets] imported ${model.lines.length} asset(s) (${fileName})`);
    }

    // ---- helpers ---------------------------------------------------------------------------------------

    /**
     * The XML seed files that live next to this source (Southwind kept them next to Program.cs and reached
     * them as "../../../AuthRules.xml" from the bin folder). See {@link terminalFile} for why they are
     * resolved off the module's own location rather than the cwd.
     */
    export function seedFile(name: string): string {
        return terminalFile(name);
    }

    async function ensureRole(name: string, strategy: MergeStrategy, inheritsFrom: RoleEntity[]): Promise<RoleEntity> {
        let role = await table(RoleEntity).filter(r => r.name == name).singleOrNull() as RoleEntity | null;
        if (role == null) {
            role = RoleEntity.create({
                name,
                mergeStrategy: strategy,
                inheritsFrom: inheritsFrom.map(r => RoleEntity_InheritsFrom.create({ inheritsFrom: r.toLite() })),
            });
            await role.save();
        }
        return role;
    }

    async function ensureUser(userName: string, roleName: string): Promise<void> {
        const existing = await table(UserEntity).filter(u => u.userName == userName).singleOrNull() as UserEntity | null;
        if (existing != null)
            return;
        const role = await table(RoleEntity).filter(r => r.name == roleName).singleOrNull() as RoleEntity | null;
        if (role == null)
            return;
        await UserEntity.create({
            userName,
            role: role.toLite(),
            state: UserState.Active,
            passwordHash: PasswordEncoding.hashPassword(userName, userName),
        }).save();
    }
}

/**
 * The database a connection string points at — Signum's `Connector.Current.DatabaseName()`, which altea's
 * Connector has no counterpart for. Only the seed needs it, and only to fill
 * `ApplicationConfigurationEntity.databaseName`, which nothing reads (see that field): a URL's last path
 * segment for PostgreSQL, the `Database=` / `Initial Catalog=` key for SQL Server. Falls back to the
 * environment name, so a string neither shape matches still satisfies the column's min length.
 */
function databaseNameOf(connectionString: string | undefined): string {
    const url = /^[a-z+]+:\/\//i.test(connectionString ?? "")
        ? connectionString!.split("?")[0]!.split("/").pop()
        : /(?:database|initial catalog)\s*=\s*([^;]+)/i.exec(connectionString ?? "")?.[1]?.trim();

    return url != null && url.length >= 3 ? url : currentEnvironment;
}
