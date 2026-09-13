import "@altea/altea/server/context.node";
import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import { Connector } from "@altea/altea/server/connection/connector";
import { Administrator } from "@altea/altea/server/Administrator";
import { Schema } from "@altea/altea/server/schema";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { Replacements } from "@altea/altea/server/sync/synchronizer";
import { AuthImportExport } from "@altea/altea-auth/server/AuthImportExport";
import { UserAssetsImporter, warmUserAssetCaches } from "@altea/altea-user-assets/server/UserAssetsImportExport";
import { Starter } from "../../app/starter.server";
import { EastwindEnvironment } from "./eastwindEnvironment";
import { requireConnectionString } from "./testDatabase";

// Port of Southwind.Test.Environment/EnvironmentTest.cs `GenerateTestEnvironment` — build the database
// every browser test starts from, and leave a SNAPSHOT of it behind.
//
// Signum writes this as an xUnit [Fact] you run by hand; here it is a script, because Playwright is the
// test runner and a "test" that drops the database has no business in the suite it would run inside.
// Everything else is the same, in the same order:
//
//   generation → schema initialize → (auth off) roles + AuthRules.xml → the test data → UserAssets.xml
//
// all of it inside `withSnapshotOrTemplateDatabase`, which is what turns the result into something
// `restoreSnapshotOrDatabase` can rewind to before every test (see test/setup.ts).
//
// The two XML seeds are applied through the FRAMEWORK's own importers, exactly as Signum's EnvironmentTest
// calls `AuthLogic.ImportAuthRules` and `UserAssetsImporter.ImportAll` rather than going through
// Southwind.Terminal. Only the files are shared (EastwindEnvironment.seedFile); no code is.
//
//   pnpm --filter eastwind gen:environment local
//
// It DROPS AND RECREATES the database it is pointed at. That is the point — but it means the environment
// argument has to name a database nobody minds losing.

/**
 * Refuse to run unless the ENVIRONMENT FILE says its database is disposable.
 *
 * `gen:environment <environment>` takes a name and drops whatever `EASTWIND_DB` resolves to, so before
 * this guard `gen:environment live` was a working command that destroyed production — one keystroke from
 * `local`, with nothing in between. A confirmation prompt would not help: the mistake is typing the wrong
 * name confidently, and the answer to "are you sure?" is yes.
 *
 * So the permission lives with the ENVIRONMENT rather than with the command. `.env.local` opts in;
 * `.env.live` and `.env.test` never do, and there is nothing to add to the command line that overrides
 * them — arming a database means editing that database's own env file, deliberately, in advance.
 *
 * It is checked HERE rather than in scripts/withEnv.mjs because this is the function that does the
 * dropping: the `gen:environment` script, the EnvironmentTest suite and anything written later all pass
 * through it.
 */
function assertDisposableDatabase(): void {
    if (process.env["EASTWIND_DISPOSABLE_DB"] === "true")
        return;

    const db = (process.env["EASTWIND_DB"] ?? "").replace(/\/\/([^:/@]*):[^@]*@/, "//$1:***@");
    throw new Error(
        `REFUSING to generate: this environment does not declare its database disposable.\n`
        + `  target: ${db || "(EASTWIND_DB unset)"}\n`
        + `\n`
        + `Generating DROPS AND RECREATES that database. Only an environment whose .env file contains\n`
        + `    EASTWIND_DISPOSABLE_DB=true\n`
        + `may be generated — see .env.example. Add it to .env.local (or whichever environment is yours to\n`
        + `lose); never to .env.test or .env.live.`);
}
export async function generateTestEnvironment(): Promise<void> {
    assertDisposableDatabase();

    const connectionString = requireConnectionString();

    // No web builder (there is no HTTP here) and no initialize: the schema is built in memory, and
    // reading anything out of it has to wait until the tables below exist.
    await Starter.start(connectionString, undefined, { initialize: false });

    const connector = Connector.current();
    console.log(`[generate] ${connector.isPostgres ? "PostgreSQL" : "SQL Server"} '${connector.databaseName()}'`);

    {
        // PostgreSQL: everything below happens in <db>_Template, and the real database is created from it
        // on the way out. SQL Server: it happens in the database itself, and a snapshot is taken.
        await using _snapshot = await Administrator.withSnapshotOrTemplateDatabase();

        console.log("[generate] cleaning + generating the schema");
        await Connector.current().cleanDatabase();
        await Schema.current.generationScript()?.executeNonQuery();
        await Schema.current.initialize();

        // Signum's `using (AuthLogic.Disable())` + `OperationLogic.AllowSaveGlobally = true`: the seed
        // runs as trusted framework code, with no logged-in user to authorize it.
        await ExecutionMode.global(async () => {
            console.log("[generate] cultures + the application configuration");
            await EastwindEnvironment.loadBasics();

            console.log("[generate] roles + AuthRules.xml");
            await EastwindEnvironment.loadRoles();
            await importAuthRules();

            console.log("[generate] the test data");
            await EastwindEnvironment.loadEmployees();
            await EastwindEnvironment.loadUsers();
            await EastwindEnvironment.loadProducts();
            await EastwindEnvironment.loadCustomers();
            await EastwindEnvironment.loadShippers();

            console.log("[generate] UserAssets.xml");
            await importUserAssets();
        });
    }

    console.log("[generate] done — the suite can now restore this state before every test");
    await Connector.current().closeConnection();
}

/**
 * Signum's `AuthLogic.ImportAuthRules(authRules, interactive: false)`. Non-interactive is the whole point
 * here: a generation has nobody to ask, so an ambiguous rename is answered "no rename" (the rule is
 * dropped) and logged, instead of blocking on a prompt.
 */
async function importAuthRules(): Promise<void> {
    const replacements = new Replacements();
    replacements.interactive = false;
    replacements.autoReplacement = ({ oldValue }) => {
        console.log(`  [auth] no-rename (drop): '${oldValue}'`);
        return { oldValue, newValue: null };
    };

    const filePath = EastwindEnvironment.seedFile("AuthRules.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");

    const result = await AuthImportExport.importAuthRules(fileContent, replacements);

    console.log(`  [auth] applied roles: ${result.appliedRoles.join(", ") || "(none)"}`);
    if (result.skippedRoles.length > 0)
        console.log(`  [auth] SKIPPED (no role after rename): ${result.skippedRoles.join(", ")}`);
}

/** Signum's `UserAssetsImporter.ImportAll(path)` — the preview says "override everything", which on a
 *  database this script just generated means "create everything". */
async function importUserAssets(): Promise<void> {
    const xml = fs.readFileSync(EastwindEnvironment.seedFile("UserAssets.xml"), "utf8");

    await warmUserAssetCaches(); // the query / type lookups the (de)serializers resolve against
    const model = await UserAssetsImporter.preview(xml);
    await UserAssetsImporter.importAssets(xml, model);

    console.log(`  [assets] imported ${model.lines.length} asset(s)`);
}

// Run as a SCRIPT (`pnpm --filter eastwind gen:environment <environment>`). The same body is also the
// environment suite's single test — see environment.test.ts — which is Signum's shape exactly: one
// [Fact] that builds the database every other suite starts from.
if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href)
    generateTestEnvironment().catch(e => { console.error(e); process.exit(1); });
