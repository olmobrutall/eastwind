import "@altea/altea/server/context.node"; // register server context storage first
import { createWebServer } from "@altea/altea/server/webApi";
import { SignumServer } from "@altea/altea/server/signumServer";
import { Connector, ConsoleSqlLogger } from "@altea/altea/server/connection/connector";
import { Starter } from "./starter.server";

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
    // Translations are auto-loaded per module inside Starter.start (loadRegisteredTranslations).

    const ws = createWebServer();
    SignumServer.start(ws);

    // Default 3001 (not 3000): a local Southwind (Signum) dev host commonly occupies 3000, so eastwind
    // sits alongside it. Override with PORT; the vite client proxy default (VITE_API_TARGET) matches.
    const port = Number(process.env["PORT"] ?? 3001);
    ws.app.listen(port, () => console.log(`[eastwind] API listening on http://localhost:${port}`));
}

main().catch(err => { console.error(`[FAILED] ${err?.message ?? err}`); process.exit(1); });
