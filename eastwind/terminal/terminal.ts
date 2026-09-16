import "@altea/altea/server/context.node"; // register server context storage first
import * as path from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import * as url from "node:url";
import chalk from "chalk";
import { Connector } from "@altea/altea/server/connection/connector";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { formatError } from "@altea/altea/server/formatError";
import { Schema } from "@altea/altea/server/schema";
import { Replacements } from "@altea/altea/server/sync/synchronizer";
import { openSqlFileRetry, syncFileName } from "@altea/altea/server/sync/openSqlFile";
import { StartParameters } from "@altea/altea/data/utils/startParameters";
import { table } from "@altea/altea/server/table";
import { Decimal } from "@altea/altea/data/basics";
import { Starter } from "../app/starter.server";
import { ConsoleSwitch } from "@altea/altea/server/consoleSwitch";
import { terminalFile } from "./terminalFile";
import { MigrationLogic } from "@altea/altea-migrations/server/MigrationLogic";
import { SqlMigrationRunner } from "@altea/altea-migrations/server/SqlMigrationRunner";
import * as Administrator from "@altea/altea/server/administrator";
import { TokenMigrationLogic } from "@altea/altea-user-assets/server/TokenMigrationLogic";
import { TokenMigrationRunner } from "@altea/altea-user-assets/server/TokenMigrationRunner";
import { Northwind } from "./northwind/northwindSchema";
import { NorthwindSeed } from "./northwind/northwindSeed";
import { RegionEntity, TerritoryEntity, EmployeeEntity } from "../app/employees/Employee.data";
import { SupplierEntity, CategoryEntity, ProductEntity } from "../app/products/Product.data";
import { ShipperEntity } from "../app/shippers/Shipper.data";
import { OrderEntity, OrderLineEntity } from "../app/orders/Order.data";
import { PersonEntity, CompanyEntity } from "../app/customers/Customer.data";
import { TypeScriptMigrations } from "./typeScriptMigrations";
import { portTranslationsCommand } from "./portTranslations";

// Port of Southwind.Terminal (old/Southwind.Terminal/Program.cs): a console host that boots the engine
// (Starter.start) then dispatches ONE command (Signum takes args.First() only) or, with no args, an
// interactive ConsoleSwitch menu. The commands mirror Southwind's, and so does the split between them:
//   • `ts`     — the ONCE-per-database code steps (roles, users, the Northwind data, the XML seeds),
//                recorded in TypeScriptMigrationEntity (`CSharpMigration` in legacy mode) →
//                TypeScriptMigrations.run.
//   • `sql`    — the versioned .sql migrations in eastwind/migrations → SqlMigrationRunner.
//   • `load`   — a sub-menu of RE-RUNNABLE ad-hoc tools, each logged to LoadMethodLog.
// altea has no CREATE DATABASE, so "new" = clean + generate into an already-existing database. The
// connection string comes from EASTWIND_DB (falling back to ALTEA_TEST_DB); "postgres…" → PG, else SQL Server.

async function main(): Promise<void> {

    console.log("Loading Eastwind...");

    const args = process.argv.slice(2);
    const command = args[0]?.toLowerCase();

    const connStr = requireConnStr();

    // Build the schema WITHOUT touching the database — Signum's terminal does the same: `Starter.Start`
    // then the menu, and only the commands that read data call `Schema.Current.Initialize()`. Initializing
    // here instead would run every startup cache against the schema that `sync` exists to repair, printing
    // a wall of mismatch warnings and a pile of queries in FRONT of the command that would fix them.
    await Starter.start(connStr, undefined, { initialize: false }); // binds Connector.default

    try {
        await connectBanner(connStr);

        if (command == null) {
            await interactive();
        } else {
            switch (command) {
                case "new":
                case "create": await create(); break;
                case "sync":
                case "synchronize": await synchronize(args); break;
                case "load": await load(args.slice(1)); break;
                case "typescript":
                case "ts": await typeScriptMigrations(args.slice(1)); break;
                case "check": await check(); break;
                case "export-auth": await exportAuth(args.slice(1)); break;
                case "import-auth": await importAuth(args.slice(1)); break;
                case "import-assets": await importAssets(args.slice(1)); break;
                case "seed-northwind": await NorthwindSeed.seed(); break;
                case "port-translations": await portTranslationsCommand(args.slice(1)); break;
                case "migrations":
                case "sql": await migrations(args.slice(1)); break;
                default: console.log(`Unknown command '${command}'. Valid: new, sync, sql, ts, load [SN,EA,IA,IU,SO], check, export-auth, import-auth, import-assets, seed-northwind, port-translations`);
            }
        }
    } finally {
        await Northwind.close();
        await Connector.current().closeConnection();
    }
}

/**
 * Initialize the schema for a command that READS data — Signum's `Schema.Current.Initialize()`, called from
 * `Load` and `CSharpMigrations` and from nowhere else.
 *
 * The terminal is the tool that BRINGS the schema up to date, so it must survive a database that trails the
 * code — otherwise the mismatch `sync` exists to fix would stop `sync` from running. Signum's
 * StartParameters.IgnoredDatabaseMismatches does exactly this: the startup caches (TypeLogic / SymbolLogic
 * / EmailModelLogic, all built with `joinRelaxed`) COLLECT their mismatches instead of throwing, and they
 * are reported once, here. The WEB HOST keeps the strict default, so a stale schema there fails loudly.
 *
 * Runs at most once per process.
 */
let initialized: Promise<void> | undefined;
function ensureInitialized(): Promise<void> {
    return initialized ??= (async () => {
        const { mismatches } = await StartParameters.withIgnoredDatabaseMismatches(() => Starter.initialize());

        if (mismatches.length > 0) {
            console.log(chalk.yellow(`[start] ${mismatches.length} database mismatch(es) — the schema trails the code, run 'sync':`));
            for (const m of mismatches)
                console.log(chalk.gray(indentLines(m.message)));
        }
    })();
}

main()
    .then(() => { console.log("[OK] terminal done"); process.exit(0); })
    .catch(err => { console.error(formatErrorRed(err)); process.exit(1); });

// Errors that surface to main are printed in red with their type, message and stack trace so a failed
// command stands out on the console. chalk handles the ANSI codes and auto-disables colour when the
// output isn't a TTY (e.g. redirected to a file or a CI log), so redirected output stays clean.
// formatError does the reading part (server/formatError): an AggregateError — what a dead database
// throws — has an EMPTY message, so `name: message` alone printed "AggregateError: " and no reason.
function formatErrorRed(err: unknown): string {
    const [head, ...rest] = formatError(err).split("\n");
    return chalk.bold.redBright(`[FAILED] ${head}`) + (rest.length > 0 ? "\n" + chalk.red(rest.join("\n")) : "");
}

// The interactive main menu (Southwind.Terminal's `new ConsoleSwitch<…>{…}.Choose()` loop). Runs until
// the user enters nothing; an action's error is printed but keeps the menu alive.
async function interactive(): Promise<void> {
    for (; ;) {
        const action = await new ConsoleSwitch<() => Promise<void>>("..:: Welcome to the Eastwind Loading Application ::..")
            .add("SN", "Seed Northwind database", () => NorthwindSeed.seed())
            .add("N", "New Database (clean + generate schema)", () => create())
            .add("S", "Synchronize (diff model vs DB)", () => synchronize())
            .add("SQL", "SQL Migrations (apply / create versioned .sql)", () => migrations([]))
            .add("TS", "TypeScript Migrations (roles, users, Northwind data, XML seeds)", () => typeScriptMigrations([]))
            .add("L", "Load (ad-hoc tools)", () => load([]))
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

/**
 * Southwind's `Program.Load(args)` — the AD-HOC TOOLS menu: a ChooseMultipleWithDescription of one-off
 * utilities, each run through `MigrationLogic.ExecuteLoadProcess` (so it lands in LoadMethodLog with its
 * timing and exception) and each RE-RUNNABLE — nothing here is recorded as a migration.
 *
 * The data loading is NOT here: that is the CODE MIGRATIONS list (`ts`, see TypeScriptMigrations.run),
 * exactly as in Southwind.
 *
 * Southwind's entries were AR (import/export auth rules), HL (help), TP (train predictor), SO (show order)
 * and EE (export embeddings). Help / MachineLearning are not ported, and there is no embeddings EXPORT here
 * (only the loader), so those three are out; AR is split into its two halves and the user-asset import — the
 * sibling of AR, and the other file-based seed — is added. SN is new: Southwind assumes a Northwind database
 * is already installed, eastwind ships the vendor script for both dialects and seeds it.
 */
async function load(args: string[]): Promise<void> {
    await ensureInitialized(); // Signum's `Load` opens with Schema.Current.Initialize()
    for (; ;) {
        const selected = await new ConsoleSwitch<() => Promise<void>>("Load processes (e.g. SN,EA,IA):")
            .add("SN", "Seed Northwind (the demo-data SOURCE database)", () => NorthwindSeed.seed())
            .add("EA", "Export Auth Rules (to ./AuthRules.xml)", () => TypeScriptMigrations.exportAuthRules())
            .add("IA", "Import Auth Rules (terminal/AuthRules.xml)", () => TypeScriptMigrations.importAuthRules())
            .add("IU", "Import User Assets (terminal/UserAssets.xml)", () => TypeScriptMigrations.importUserAssets())
            .add("SO", "Show Order (the most expensive discounted order)", () => showOrder())
            .chooseMultipleWithDescription(args);

        if (selected == null || selected.length === 0)
            return;

        for (const step of selected)
            await MigrationLogic.executeLoadProcess(step.value, step.description, "EastwindTerminal");

        if (args.length > 0)
            return; // non-interactive (`load EA,IA`): run the selection once and leave
    }
}

/**
 * Southwind's `Program.ShowOrder`: the most expensive order that has a discounted line. A tiny end-to-end
 * exercise of the LINQ provider from the console (Signum's own debugging entry).
 */
async function showOrder(): Promise<void> {
    const order = await table(OrderEntity)
        // `discount != 0` on a Decimal: the comparison operators are not quoted (only the arithmetic is),
        // so the translatable spelling of "is not zero" is Decimal.sign(x) — 0 exactly when the value is.
        .filter(o => o.details.some(l => Decimal.sign(l.discount) != 0))
        .orderByDescending(o => o.totalPrice())
        .firstOrNull() as OrderEntity | null;

    if (order == null) {
        console.log("  (no discounted order found)");
        return;
    }
    console.log(`  Order ${order.id} — ${order.customer.toString()} — total ${order.totalPrice().toString()}`);
    for (const line of order.details)
        console.log(`    ${line.product.toString()} x${line.quantity} @${line.unitPrice} -${line.discount}`);
}//showOrder

/**
 * Southwind's `csharp` command / `CS` menu entry → `SouthwindMigrations.CSharpMigrations(autoRun)`: the
 * ordered, once-per-database code steps (roles, users, the Northwind loaders, the XML seeds). Named for
 * the language they are actually written in; the TABLE behind them keeps Signum's name.
 */
async function typeScriptMigrations(args: string[]): Promise<void> {
    await ensureInitialized(); // Signum's `SouthwindMigrations.CSharpMigrations` opens with it too
    await TypeScriptMigrations.run(/* autoRun */ args.includes("--auto") || !process.stdin.isTTY);
}

// Southwind's `SqlMigrationRunner.SqlMigrations()` (its Program.cs "SQL" option): the versioned .sql files in
// eastwind/migrations are the schema's source of truth — apply what is pending, or write the next migration
// from the synchronization script.
async function migrations(args: string[]): Promise<void> {
    // Signum's SqlMigrationRunner does not initialize, but its TokenMigrationRunner does — and altea wires
    // the token migrations onto `afterMigrationsCompleted` below, so this command may reach them.
    await ensureInitialized();
    SqlMigrationRunner.migrationsDirectory = migrationsDir();
    wireTokenMigrations();
    await SqlMigrationRunner.sqlMigrations(/* autoRun */ args.includes("--auto") || !process.stdin.isTTY);
}

/**
 * The three hooks that make TOKEN migrations part of the ordinary schema workflow — Signum registers them
 * inside `TokenMigrationLogic.Start`, but @altea/altea-user-assets must not depend on
 * @altea/altea-migrations (a user-assets app need not have migrations at all), so the APP wires them.
 * The terminal is the right place: it is what owns both, and both are console workflows.
 *
 * Idempotent, because `migrations` and `sync` can both run in one interactive session.
 */
function wireTokenMigrations(): void {
    if (SqlMigrationRunner.afterMigrationsCompleted.includes(TokenMigrationRunner.tokenMigrations))
        return;

    // After the .sql migrations have run: apply any pending .tokens.json, or offer to record one.
    SqlMigrationRunner.afterMigrationsCompleted.push(TokenMigrationRunner.tokenMigrations);
    // When a new .sql migration is written: drain the QUERY renames it resolved into a sibling
    // .query.json, so they are on disk before the old query names are gone from the schema.
    SqlMigrationRunner.afterCreatingMigration.push(TokenMigrationLogic.afterMigrationCreated);
    // After a schema `sync`: the renames it just resolved are exactly the ones that invalidate stored
    // tokens, so offer to record them while they are still in hand.
    Administrator.afterSynchronize.push(TokenMigrationRunner.afterSynchronize);
}

// eastwind/terminal/sync — where `sync` drops the script it asks you to review. Beside the terminal's own
// data files rather than in the cwd (Signum writes to the working directory, so the script lands wherever
// the terminal happened to be launched from), and gitignored as a whole: a synchronization script is a
// throwaway artefact of ONE database's drift, never source. A migration you mean to KEEP is a different
// thing and goes to eastwind/migrations through the `sql` command.
const syncDirectory = terminalFile("sync");

// eastwind/migrations — resolved off this module so the cwd does not matter (dist/terminal → ../../migrations).
function migrationsDir(): string {
    return path.resolve(url.fileURLToPath(new URL(".", import.meta.url)), "../../migrations");
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

async function synchronize(args: string[] = []): Promise<void> {
    // `--apply`: run the script without asking. For a DEV database and for CI, where there is no console to
    // review it on — the script is still written to terminal/sync/ first, so what ran is on disk.
    const apply = args.includes("--apply");
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
    // Token migrations hang off `Administrator.afterSynchronize` — see wireTokenMigrations. Wired here
    // too, because `sync` is reachable without ever running `migrations`.
    SqlMigrationRunner.migrationsDirectory = migrationsDir();
    wireTokenMigrations();

    const script = await Schema.current.synchronizationScript(replacements);
    if (script == null) {
        console.log("[sync] database already in sync");
        // Signum fires the hook with (null, null) here: an already-synchronized SCHEMA can still have
        // pending TOKEN work, so the pass must be offered rather than skipped. Only on a real console —
        // it prompts, and a headless caller has nobody to answer.
        if (replacements.interactive)
            await Administrator.onAfterSynchronize(null, null);
        return;
    }
    // Signum's Administrator.SynchronizeSchema: SAVE the script, print it and its path, then ask
    // run / open / exit — never apply it unasked. Applying it is ONE transaction, so a mid-script failure
    // (a PK-type migration that fails partway) rolls back rather than leaving the database half-migrated.
    if (apply) {
        const fileName = join(resolve(syncDirectory), syncFileName(new Date()));
        mkdirSync(dirname(fileName), { recursive: true });
        writeFileSync(fileName, script.plainSql(), "utf8");
        console.log("[sync] applying " + fileName);
        await Transaction.create(async () => {
            await Connector.current().executeNonQuery(script.plainSql());
        });
        await Schema.current.initialize();
        console.log("[sync] applied");
        return;
    }

    const { fileName, executed } = await openSqlFileRetry(script, syncDirectory, syncFileName(new Date()));
    if (!executed) {
        console.log("[sync] not applied — the script is in " + fileName);
        return;
    }

    // A sync may have inserted/renamed/removed types — refresh the caches from the DB (outside the txn, so
    // it reads the committed state).
    await Schema.current.initialize();
    console.log("[sync] applied");

    // Signum's `AfterSynchronize?.Invoke(fileName, rep)` — with the Replacements this sync collected,
    // which is where the renames that invalidated stored tokens are. Interactive only (it prompts).
    if (replacements.interactive)
        await Administrator.onAfterSynchronize(fileName, replacements);
}

// The three file-based seeds as DIRECT commands (a deploy script calls these). The bodies live in
// TypeScriptMigrations — the Load menu and the code-migration list call exactly the same functions.
async function exportAuth(args: string[]): Promise<void> {
    await ensureInitialized();
    await TypeScriptMigrations.exportAuthRules(args[0]);
}

async function importAuth(args: string[]): Promise<void> {
    await ensureInitialized();
    await TypeScriptMigrations.importAuthRules(args[0]);
}

async function importAssets(args: string[]): Promise<void> {
    await ensureInitialized();
    await TypeScriptMigrations.importUserAssets(args.find(a => !a.startsWith("--")), args.includes("--keep-existing"));
}

// Read-back health check: row counts of every table via altea's LINQ.
async function check(): Promise<void> {
    await ensureInitialized();
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

/** Indent a multi-line mismatch message so the report reads as one block. */
function indentLines(text: string): string {
    return text.split(/\r?\n/).map(l => "    " + l).join("\n");
}

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
