import "@altea/altea/server/context.node"; // register server context storage first
import { createWebServer } from "@altea/altea/server/webApi";
import { SignumServer } from "@altea/altea/server/signumServer";
import { Connector, ConsoleSqlLogger } from "@altea/altea/server/connection/connector";
import { loadTranslationsFromDir } from "@altea/altea/server/translations";
import { Starter } from "./starter";

// eastwind web host (Southwind.Server/Program.cs). Builds the schema + binds the connector (Starter),
// mounts the framework HTTP API (SignumServer), then listens. Client serving (static / vite dev switch)
// is Phase 4. Run: node --import ./register.mjs --env-file=.env.postgres dist/server/webServer.js
async function main(): Promise<void> {
    const connStr = process.env["EASTWIND_DB"] ?? process.env["ALTEA_TEST_DB"];
    if (connStr == null || connStr === "")
        throw new Error("Set EASTWIND_DB (or ALTEA_TEST_DB) to a connection string.");

    const { connector } = await Starter.start(connStr); // builds schema + sets Connector.default
    if (process.env["SQL_LOG"]) Connector.currentLogger = new ConsoleSqlLogger();
    const label = connector.isPostgres ? "PostgreSQL" : "SQL Server";
    console.log(`[eastwind] engine started (${label}: ${Connector.redactConnectionString(connStr)})`);

    // Load Signum-format translation XMLs (`<name>.<culture>.xml`) so the reflection metadata endpoint
    // can ship them per UI culture. Optional — set TRANSLATIONS_DIR to a folder of translation files.
    const translationsDir = process.env["TRANSLATIONS_DIR"];
    if (translationsDir != null && translationsDir !== "") {
        loadTranslationsFromDir(translationsDir);
        console.log(`[eastwind] translations loaded from ${translationsDir}`);
    }

    const ws = createWebServer();
    SignumServer.start(ws);

    const port = Number(process.env["PORT"] ?? 3000);
    ws.app.listen(port, () => console.log(`[eastwind] API listening on http://localhost:${port}`));
}

main().catch(err => { console.error(`[FAILED] ${err?.message ?? err}`); process.exit(1); });
