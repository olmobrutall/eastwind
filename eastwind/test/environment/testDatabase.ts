import "@altea/altea/server/context.node";
import { Connector } from "@altea/altea/server/connection/connector";
import { Starter } from "../../app/starter.server";

// The DATABASE half of the test harness: the connection string the suite (and the environment generator)
// work against, and the one-per-process engine boot that makes `table(OrderEntity)`, an operation and a
// save available inside a spec.
//
// It is the SAME database the stack under test is serving — that is the point: a test arranges a row here
// and then drives the browser to it. The environment is therefore chosen the way every other eastwind
// entry point chooses one, by naming it (`pnpm --filter eastwind test local`), and `.env.local` is what
// the local stack runs on.

/** The connection string of the database under test (`EASTWIND_DB`, out of the chosen `.env.<environment>`). */
/**
 * Whether a database is configured at all — the gate every DB-backed suite skips on, and the same shape
 * @altea/altea's test/server/setup.ts uses. A machine with no `.env` reports its suites skipped, not
 * failed.
 */
export const hasDb = (process.env["EASTWIND_DB"] ?? "") !== "";

export function requireConnectionString(): string {
    const connectionString = process.env["EASTWIND_DB"];
    if (connectionString == null || connectionString === "")
        throw new Error("EASTWIND_DB is not set. Run through the wrapper that loads an environment file:\n"
            + "  pnpm --filter eastwind test <environment>\n"
            + "  pnpm --filter eastwind gen:environment <environment>");
    return connectionString;
}

let started: Promise<void> | undefined;

/**
 * Build the schema and bind the connector, once per process — Signum's `SouthwindEnvironment.
 * StartAndInitialize()`, which its test base class calls from every constructor.
 *
 * No web builder: this process talks to the database, never over HTTP. `Schema.initialize` runs as part
 * of it (the default), because everything a spec does afterwards reads data.
 */
export function startEngine(): Promise<void> {
    return (started ??= Starter.start(requireConnectionString()));
}

/** Release the pool — a Playwright worker calls this on the way out so node can exit. */
export async function stopEngine(): Promise<void> {
    if (started == null)
        return;
    await started;
    await Connector.current().closeConnection();
    started = undefined;
}
