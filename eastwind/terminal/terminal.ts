import "@altea/altea/server/context.node"; // register server context storage first
import * as fs from "node:fs";
import chalk from "chalk";
import { Connector } from "@altea/altea/server/connection/connector";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { Schema } from "@altea/altea/server/schema";
import { Replacements } from "@altea/altea/server/sync/synchronizer";
import { AuthImportExport } from "@altea/altea-auth/server/AuthImportExport";
import { table } from "@altea/altea/server/table";
import { Starter } from "../starter.server";
import { ConsoleSwitch, executeLoadProcess } from "./consoleSwitch";
import { EmployeeLoader } from "./employeeLoader";
import { ProductLoader } from "./productLoader";
import { CustomerLoader } from "./customerLoader";
import { OrderLoader } from "./orderLoader";
import { Northwind } from "./northwindSchema";
import { RegionEntity, TerritoryEntity, EmployeeEntity } from "../employees/Employee.data";
import { SupplierEntity, CategoryEntity, ProductEntity } from "../products/Product.data";
import { ShipperEntity } from "../shippers/Shipper.data";
import { OrderEntity, OrderLineEntity } from "../orders/Order.data";
import { PersonEntity, CompanyEntity } from "../customers/Customer.data";
import { EastwindMigrations } from "./eastwindMigrations";

// Port of Southwind.Terminal (old/Southwind.Terminal/Program.cs): a console host that boots the engine
// (Starter.start) then dispatches ONE command (Signum takes args.First() only) or, with no args, an
// interactive ConsoleSwitch menu. Commands: new|create, sync, load [1-10], check. "Load" opens a
// ChooseMultipleWithDescription sub-menu of the Northwind loaders (Southwind's Load). altea has no
// CREATE DATABASE, so "new" = clean + generate into an already-existing database. The connection string
// comes from EASTWIND_DB (falling back to ALTEA_TEST_DB); "postgres…" → PostgreSQL, else SQL Server.

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    const command = args[0]?.toLowerCase();

    const connStr = requireConnStr();
    await Starter.start(connStr); // binds Connector.default; reach the schema via Schema.current
    try {
        await connectBanner(connStr);

        if (command == null) {
            await interactive();
        } else {
            switch (command) {
                case "new":
                case "create": await create(); break;
                case "sync":
                case "synchronize": await synchronize(); break;
                case "load": await load(args.slice(1)); break;
                case "check": await check(); break;
                case "export-auth": await exportAuth(args.slice(1)); break;
                case "import-auth": await importAuth(args.slice(1)); break;
                default: console.log(`Unknown command '${command}'. Valid: new, sync, load [1-15], check, export-auth, import-auth`);
            }
        }
    } finally {
        await Northwind.close();
        await Connector.current().closeConnection();
    }
}

main()
    .then(() => { console.log("[OK] terminal done"); process.exit(0); })
    .catch(err => { console.error(formatErrorRed(err)); process.exit(1); });

// Errors that surface to main are printed in red with their type, message and stack trace so a failed
// command stands out on the console. chalk handles the ANSI codes and auto-disables colour when the
// output isn't a TTY (e.g. redirected to a file or a CI log), so redirected output stays clean.
function formatErrorRed(err: unknown): string {
    const e = err as Error | undefined;
    const name = e?.name ?? "Error";
    const message = e?.message ?? String(err);
    const stack = e?.stack ?? "(no stack trace)";
    return chalk.bold.redBright(`[FAILED] ${name}: ${message}`) + "\n" + chalk.red(stack);
}

// The interactive main menu (Southwind.Terminal's `new ConsoleSwitch<…>{…}.Choose()` loop). Runs until
// the user enters nothing; an action's error is printed but keeps the menu alive.
async function interactive(): Promise<void> {
    for (; ;) {
        const action = await new ConsoleSwitch<() => Promise<void>>("..:: Welcome to the Eastwind Loading Application ::..")
            .add("N", "New Database (clean + generate schema)", () => create())
            .add("S", "Synchronize (diff model vs DB)", () => synchronize())
            .add("L", "Load Northwind data (+ roles/users)", () => load([]))
            .add("C", "Check (row counts)", () => check())
            .choose();

        if (action == null) return;
        try {
            await action();
        } catch (e) {
            console.error(formatErrorRed(e));
        }
    }
}

// Southwind's Load(): a ChooseMultipleWithDescription sub-menu of the Northwind loaders, run in order
// via ExecuteLoadProcess (auto-logging). The menu order is the dependency order. `load 1-16` runs all.
async function load(args: string[]): Promise<void> {
    // Order mirrors Southwind's SouthwindMigrations.CSharpMigrations: CreateRoles + CreateSystemUser
    // first, then the Northwind data loaders, then EmployeeLoader.CreateUsers (needs employees + roles),
    // and finally ImportAuthRules (Southwind's InitialAuthRulesImport). `load 1-16` runs the lot.
    const selected = await new ConsoleSwitch<() => Promise<void>>("Load processes (e.g. 1-16):")
        .add("1", "Create Roles", () => EastwindMigrations.createRoles())
        .add("2", "Create System User", () => EastwindMigrations.createSystemUser())
        .add("3", "Load Regions", () => EmployeeLoader.loadRegions())
        .add("4", "Load Territories", () => EmployeeLoader.loadTerritories())
        .add("5", "Load Employees", () => EmployeeLoader.loadEmployees())
        .add("6", "Load Suppliers", () => ProductLoader.loadSuppliers())
        .add("7", "Load Categories", () => ProductLoader.loadCategories())
        .add("8", "Load Products", () => ProductLoader.loadProducts())
        .add("9", "Load Companies", () => CustomerLoader.loadCompanies())
        .add("10", "Load Persons", () => CustomerLoader.loadPersons())
        .add("11", "Load Shippers", () => OrderLoader.loadShippers())
        .add("12", "Load Orders", () => OrderLoader.loadOrders())
        .add("13", "Create Users", () => EmployeeLoader.createUsers())
        .add("14", "Load Employee Passages (embeddings)", () => EmployeeLoader.loadEmployeePassages())
        .add("15", "Create Default Toolbar", () => EastwindMigrations.createDefaultToolbar())
        .add("16", "Import Auth Rules", () => EastwindMigrations.importAuthRules())
        .chooseMultipleWithDescription(args);

    if (selected == null || selected.length === 0) return;
    for (const step of selected)
        await executeLoadProcess(step.description, step.value);
}

async function create(): Promise<void> {
    console.log("[new] cleaning database");
    await Connector.current().cleanDatabase();
    console.log("[new] generating schema");
    await Schema.current.generationScript()?.executeNonQuery();
    // Read back the TypeEntity ids the DB just assigned, so a subsequent load in this same
    // process (interactive menu) resolves discriminators against the persisted ids.
    await Schema.current.initialize();
    console.log("[new] schema generation complete");
}

async function synchronize(): Promise<void> {
    const replacements = new Replacements();
    replacements.interactive = Boolean(process.stdin.isTTY); // prompt for renames only on a real console
    // Headless (no TTY): we can't prompt, so instead of ABORTING on an ambiguous column/table rename, treat
    // every one as no-rename → drop + add (Signum's AutoReplacement pattern), logging each decision. This is
    // the safe CI/dev default; a real rename with data to preserve should be run on an interactive console.
    if (!replacements.interactive)
        replacements.autoReplacement = ({ oldValue, replacementKey }) => {
            console.log(`[sync] no-rename (drop+add): '${oldValue}' in ${replacementKey}`);
            return { oldValue, newValue: null };
        };
    const script = await Schema.current.synchronizationScript(replacements);
    if (script == null) {
        console.log("[sync] database already in sync");
        return;
    }
    console.log("[sync] synchronization script:\n" + script.plainSql());
    // Apply the whole script atomically: a mid-script failure (e.g. a PK-type migration that fails partway)
    // rolls back so the database is never left half-migrated. Postgres runs DDL transactionally; on SQL
    // Server most DDL is transactional too (a few statements auto-commit — acceptable for a dev sync).
    await Transaction.create(async () => {
        await script.executeNonQuery();
    });
    // A sync may have inserted/renamed/removed types — refresh the caches from the DB (outside the txn, so
    // it reads the committed state).
    await Schema.current.initialize();
    console.log("[sync] applied");
}

// Export all authorization rules to a Southwind-style AuthRules.xml (Signum's AuthLogic.ExportRules).
async function exportAuth(args: string[]): Promise<void> {
    const file = args[0] ?? "AuthRules.xml";
    fs.writeFileSync(file, await AuthImportExport.exportAuthRules(), "utf8");
    console.log(`[export-auth] wrote ${file}`);
}

// Import authorization rules from an AuthRules.xml (Signum's AutomaticImportAuthRules). Renames are asked
// on a real console; headless (no TTY) treats every ambiguous rename as no-rename (drop), logged.
async function importAuth(args: string[]): Promise<void> {
    const file = args[0] ?? "AuthRules.xml";
    const xml = fs.readFileSync(file, "utf8");
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
    console.log(`[import-auth] done (${file})`);
}

// Read-back health check: row counts of every table via altea's LINQ.
async function check(): Promise<void> {
    const count = async (label: string, rows: Promise<unknown[]>): Promise<string> => `${label}=${(await rows).length}`;
    const parts = [
        await count("Regions", table(RegionEntity).toArray()),
        await count("Territories", table(TerritoryEntity).toArray()),
        await count("Employees", table(EmployeeEntity).toArray()),
        await count("Suppliers", table(SupplierEntity).toArray()),
        await count("Categories", table(CategoryEntity).toArray()),
        await count("Products", table(ProductEntity).toArray()),
        await count("Companies", table(CompanyEntity).toArray()),
        await count("Persons", table(PersonEntity).toArray()),
        await count("Shippers", table(ShipperEntity).toArray()),
        await count("Orders", table(OrderEntity).toArray()),
        await count("OrderLines", table(OrderLineEntity).toArray()),
    ];
    console.log("[check] " + parts.join(" "));
}

// ---- bootstrap helpers -----------------------------------------------------------------------

function requireConnStr(): string {
    const connStr = process.env["EASTWIND_DB"] ?? process.env["ALTEA_TEST_DB"];
    if (connStr == null || connStr === "")
        throw new Error(
            "Set EASTWIND_DB (or ALTEA_TEST_DB) to a connection string. Start it with 'postgres' for " +
            "PostgreSQL; otherwise it is treated as a SQL Server connection string.",
        );
    return connStr;
}

// Touch the database so a bad host/credential fails here with a clear message and the server banner is
// surfaced (mirrors MusicStarter's connect probe + Southwind.Terminal's coloured env banner).
async function connectBanner(connStr: string): Promise<void> {
    const connector = Connector.current();
    const label = connector.isPostgres ? "PostgreSQL" : "SQL Server";
    const target = Connector.redactConnectionString(connStr);
    console.log(`[${label}] connecting: ${target}`);
    try {
        const bannerSql = connector.isPostgres ? "select version() as v" : "select @@version as v";
        const rows = (await connector.executeQuery(bannerSql)) as Array<{ v: string }>;
        console.log(`[${label}] connected — ${rows[0]?.v?.split("\n")[0] ?? "(ok)"}`);
    } catch (err) {
        throw new Error(`Could not connect to ${label} (${target}): ${(err as Error)?.message ?? err}`);
    }
}
