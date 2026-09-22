import "@altea/altea/server/context.node"; // register server context storage first
import { createWebServer } from "@altea/altea/server/webApi";
import { useExceptionFilter } from "@altea/altea/server/filters/exceptionFilter";
import { Connector, ConsoleSqlLogger } from "@altea/altea/server/connection/connector";
import { formatError } from "@altea/altea/server/formatError";
import { SystemEventServer } from "@altea/altea/server/systemEventServer";
import { ProcessRunner } from "@altea/altea-processes/server/ProcessRunner";
import { ScheduleTaskRunner } from "@altea/altea-scheduler/server/ScheduleTaskRunner";
import { AsyncEmailSender } from "@altea/altea-email/server/AsyncEmailSender";
import { Starter } from "./starter.server";

// The eastwind web host. Creates the WebBuilder and hands it to Starter.start;
// Starter sets it on the SchemaBuilder so each module's `XxxLogic.start` mounts its own HTTP surface
// (the framework API from SignumServer.start, /api/auth + /api/authAdmin from AuthLogic.start), then the
// host closes the pipeline and listens.
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/webServer.server.js
async function main(): Promise<void> {
    const connStr = process.env["EASTWIND_DB"] ?? process.env["ALTEA_TEST_DB"];
    if (connStr == null || connStr === "")
        throw new Error("Set EASTWIND_DB (or ALTEA_TEST_DB) to a connection string.");

    const ws = createWebServer();
    await Starter.start(connStr, ws); // builds schema, binds Connector.default, mounts all HTTP
    // The JSON error funnel, and it belongs to the HOST because it must be registered after EVERY route in
    // the process — Express error middleware only catches what was registered before it. Without it a
    // failed request answers Express's HTML stack page instead of the `HttpError` the client's
    // ThrowErrorFilter parses, so errors stop surfacing as error modals.
    useExceptionFilter(ws);
    if (process.env["SQL_LOG"]) Connector.currentLogger = new ConsoleSqlLogger();
    const label = Connector.current().isPostgres ? "PostgreSQL" : "SQL Server";
    console.log(`[eastwind] engine started (${label}: ${Connector.redactConnectionString(connStr)})`);

    // Default 3001 (not 3000): a local legacy dev host commonly occupies 3000, so eastwind
    // sits alongside it. Override with PORT; the vite client proxy default (VITE_API_TARGET) matches.
    const port = Number(process.env["PORT"] ?? 3001);
    const server = ws.app.listen(port, () => console.log(`[eastwind] API listening on http://localhost:${port}`));
    // WebSocket hubs (altea's SignalR substitute — altea/server/webSocketHub.ts) can only be bound once
    // there IS an http.Server to hear `upgrade` on, which is after listen. A module registered its hub
    // during Starter.start (e.g. altea-concurrent-user); this is what makes them reachable.
    ws.attachWebSockets(server);
    // Without this, a failed bind (e.g. EADDRINUSE from an orphaned prior run) never refs the event loop,
    // so the process just drains and exits code 0 — a phantom "clean" exit that reads as success. Surface it.
    server.on("error", err => fail(err));

    // Record that this
    // process came up, and arrange for it to record its own shutdown. AFTER listen, so a boot that cannot
    // even bind its port is not filed as a successful start; and awaited, so the row exists before the
    // host is considered up. See server/systemEventServer for what a MISSING stop row means.
    await SystemEventServer.logStartStop();

    // The three BACKGROUND RUNNERS, a few seconds after the host is up. They live HERE and not in the
    // Starter because picking work up is the WEB HOST's job: a terminal command or a test builds the very
    // same schema and must not start executing processes, scheduled tasks and queued mail behind itself.
    ProcessRunner.startRunningProcessesAfter(5000);
    ScheduleTaskRunner.startScheduledTasksAfter(5000);
    AsyncEmailSender.startAsyncEmailSenderAfter(5000);
}

// Both exits print through formatError, never `err.message`: the message of the error a dead database
// produces is EMPTY (an AggregateError — see server/formatError), so this used to print `[FAILED]` and
// nothing else, which said neither what failed nor where.
function fail(err: unknown): never {
    console.error(`[FAILED] ${formatError(err)}`);
    process.exit(1);
}

main().catch(fail);
