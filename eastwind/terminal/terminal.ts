import "@altea/altea/server/context.node"; // register server context storage first
import { Connector } from "@altea/altea/server/connection/connector";
import type { SchemaBuilder } from "@altea/altea/server/schema";
import { Replacements } from "@altea/altea/server/sync/synchronizer";
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
    const { sb, connector } = await Starter.start(connStr);
    try {
        await connectBanner(connector, connStr);

        if (command == null) {
            await interactive(sb, connector);
        } else {
            switch (command) {
                case "new":
                case "create": await create(sb, connector); break;
                case "sync":
                case "synchronize": await synchronize(sb); break;
                case "load": await load(args.slice(1)); break;
                case "check": await check(); break;
                default: console.log(`Unknown command '${command}'. Valid: new, sync, load [1-10], check`);
            }
        }
    } finally {
        await Northwind.close();
        await connector.closeConnection();
    }
}

main()
    .then(() => { console.log("[OK] terminal done"); process.exit(0); })
    .catch(err => { console.error(`[FAILED] ${err?.message ?? err}`); process.exit(1); });

// The interactive main menu (Southwind.Terminal's `new ConsoleSwitch<…>{…}.Choose()` loop). Runs until
// the user enters nothing; an action's error is printed but keeps the menu alive.
async function interactive(sb: SchemaBuilder, connector: Connector): Promise<void> {
    for (;;) {
        const action = await new ConsoleSwitch<() => Promise<void>>("..:: Welcome to the Eastwind Loading Application ::..")
            .add("N", "New Database (clean + generate schema)", () => create(sb, connector))
            .add("S", "Synchronize (diff model vs DB)", () => synchronize(sb))
            .add("L", "Load Northwind data", () => load([]))
            .add("C", "Check (row counts)", () => check())
            .choose();

        if (action == null) return;
        try {
            await action();
        } catch (e) {
            console.error(`${(e as Error)?.name ?? "Error"}: ${(e as Error)?.message ?? e}`);
        }
    }
}

// Southwind's Load(): a ChooseMultipleWithDescription sub-menu of the Northwind loaders, run in order
// via ExecuteLoadProcess (auto-logging). The menu order is the dependency order. `load 1-10` runs all.
async function load(args: string[]): Promise<void> {
    const selected = await new ConsoleSwitch<() => Promise<void>>("Northwind load processes (e.g. 1-10):")
        .add("1", "Load Regions", () => EmployeeLoader.loadRegions())
        .add("2", "Load Territories", () => EmployeeLoader.loadTerritories())
        .add("3", "Load Employees", () => EmployeeLoader.loadEmployees())
        .add("4", "Load Suppliers", () => ProductLoader.loadSuppliers())
        .add("5", "Load Categories", () => ProductLoader.loadCategories())
        .add("6", "Load Products", () => ProductLoader.loadProducts())
        .add("7", "Load Companies", () => CustomerLoader.loadCompanies())
        .add("8", "Load Persons", () => CustomerLoader.loadPersons())
        .add("9", "Load Shippers", () => OrderLoader.loadShippers())
        .add("10", "Load Orders", () => OrderLoader.loadOrders())
        .chooseMultipleWithDescription(args);

    if (selected == null || selected.length === 0) return;
    for (const step of selected)
        await executeLoadProcess(step.description, step.value);
}

async function create(sb: SchemaBuilder, connector: Connector): Promise<void> {
    console.log("[new] cleaning database");
    await connector.cleanDatabase();
    console.log("[new] generating schema");
    await sb.schema.generationScript()?.executeNonQuery();
    console.log("[new] schema generation complete");
}

async function synchronize(sb: SchemaBuilder): Promise<void> {
    const replacements = new Replacements();
    replacements.interactive = Boolean(process.stdin.isTTY); // prompt for renames only on a real console
    const script = await sb.schema.synchronizationScript(replacements);
    if (script == null) {
        console.log("[sync] database already in sync");
        return;
    }
    console.log("[sync] synchronization script:\n" + script.plainSql());
    await script.executeNonQuery();
    console.log("[sync] applied");
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
async function connectBanner(connector: Connector, connStr: string): Promise<void> {
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
