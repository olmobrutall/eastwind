import "@altea/altea/server/context.node"; // register server context storage first
import { createWebServer } from "@altea/altea/server/webApi";
import { Connector, ConsoleSqlLogger } from "@altea/altea/server/connection/connector";
import { Starter } from "./starter.server";

// eastwind web host (Southwind.Server/Program.cs). Creates the WebBuilder and hands it to Starter.start;
// Starter sets it on the SchemaBuilder so each module's `XxxLogic.start` mounts its own HTTP surface
// (auth middleware + /api/auth + /api/authAdmin from AuthLogic.start, the framework API from
// SignumServer.start), then the host just listens. The host no longer re-lists the server modules.
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/webServer.server.js
async function main(): Promise<void> {
    const connStr = process.env["EASTWIND_DB"] ?? process.env["ALTEA_TEST_DB"];
    if (connStr == null || connStr === "")
        throw new Error("Set EASTWIND_DB (or ALTEA_TEST_DB) to a connection string.");

    const ws = createWebServer();
    await Starter.start(connStr, ws); // builds schema, binds Connector.default, mounts all HTTP
    if (process.env["SQL_LOG"]) Connector.currentLogger = new ConsoleSqlLogger();
    const label = Connector.current().isPostgres ? "PostgreSQL" : "SQL Server";
    console.log(`[eastwind] engine started (${label}: ${Connector.redactConnectionString(connStr)})`);

    // Default 3001 (not 3000): a local Southwind (Signum) dev host commonly occupies 3000, so eastwind
    // sits alongside it. Override with PORT; the vite client proxy default (VITE_API_TARGET) matches.
    const port = Number(process.env["PORT"] ?? 3001);
    const server = ws.app.listen(port, () => console.log(`[eastwind] API listening on http://localhost:${port}`));
    // WebSocket hubs (altea's SignalR substitute — altea/server/webSocketHub.ts) can only be bound once
    // there IS an http.Server to hear `upgrade` on, which is after listen. A module registered its hub
    // during Starter.start (e.g. altea-concurrent-user); this is what makes them reachable.
    ws.attachWebSockets(server);
    // Without this, a failed bind (e.g. EADDRINUSE from an orphaned prior run) never refs the event loop,
    // so the process just drains and exits code 0 — a phantom "clean" exit that reads as success. Surface it.
    server.on("error", err => { console.error(`[FAILED] ${err instanceof Error ? err.message : err}`); process.exit(1); });
}

main().catch(err => { console.error(`[FAILED] ${err?.message ?? err}`); process.exit(1); });
