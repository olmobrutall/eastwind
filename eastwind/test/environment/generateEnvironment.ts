import "@altea/altea/server/context.node";
import { Connector } from "@altea/altea/server/connection/connector";
import { Administrator } from "@altea/altea/server/Administrator";
import { Schema } from "@altea/altea/server/schema";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { Starter } from "../../starter.server";
import { TypeScriptMigrations } from "../../terminal/typeScriptMigrations";
import { EastwindEnvironment } from "./eastwindEnvironment";
import { requireConnectionString } from "../testDatabase";

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
// `restoreSnapshotOrDatabase` can rewind to before every test (see test/fixtures.ts).
//
//   pnpm --filter eastwind gen:environment local
//
// It DROPS AND RECREATES the database it is pointed at. That is the point — but it means the environment
// argument has to name a database nobody minds losing.
async function main(): Promise<void> {
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
            await TypeScriptMigrations.createCulturesAndConfiguration();

            console.log("[generate] roles + AuthRules.xml");
            await TypeScriptMigrations.createRoles();
            await TypeScriptMigrations.importAuthRules();

            console.log("[generate] the test data");
            await EastwindEnvironment.loadEmployees();
            await EastwindEnvironment.loadUsers();
            await EastwindEnvironment.loadProducts();
            await EastwindEnvironment.loadCustomers();
            await EastwindEnvironment.loadShippers();

            console.log("[generate] UserAssets.xml");
            await TypeScriptMigrations.importUserAssets();
        });
    }

    console.log("[generate] done — the suite can now restore this state before every test");
    await Connector.current().closeConnection();
}

main().catch(e => { console.error(e); process.exit(1); });
