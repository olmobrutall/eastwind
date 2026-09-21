import { beforeAll, beforeEach, afterAll } from "vitest";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { Administrator } from "@altea/altea/server/Administrator";
import { UserHolder } from "@altea/altea/server/userHolder";
import { UserWithClaims } from "@altea/altea/data/security";
import { EastwindBrowser } from "./eastwindBrowser";
import { EastwindEnvironment } from "../environment/eastwindEnvironment";
import { startEngine, stopEngine } from "../environment/testDatabase";
import { baseUrl, clearServerCaches } from "./appStack";

// Shared test bootstrap for the BROWSER suites — the same shape as @altea/altea's test/server/setup.ts,
// deliberately: a `hasX` gate, a memoised `start()` a suite calls from its own `before`, and hooks this
// module registers itself. A suite therefore reads the way every other suite in the workspace reads:
//
//     describe.skipIf(!hasStack)("Orders", () => {
//         test("…", async () => {
//             await browse(TestUser.Standard, async b => { … });
//         });
//     });
//
// Playwright is used as a LIBRARY, never `@playwright/test`: the suites are vitest like everything
// else, so one runner covers logic and browser alike.

/**
 * Whether a stack is actually serving — the browser counterpart of `hasDb`, and resolved at MODULE LOAD
 * with a top-level await, which is load-bearing.
 *
 * `describe(..., { skip })` evaluates its options when the suite is DECLARED, as the file is evaluated —
 * before any `before` hook runs. Pinging inside `before` therefore always reports "down" to the skip
 * option and the suite never runs, however healthy the stack is. Awaiting here means importing this
 * module settles it, and that import completes before the describe is reached.
 *
 * A browser suite needs a stack someone started in another terminal (`pnpm --filter eastwind stack
 * local`). A machine that cannot run a test should report it skipped, not failed — otherwise the Test
 * Explorer is a wall of red on any checkout where the stack happens to be down.
 */
export const hasStack = await ping();

async function ping(): Promise<boolean> {
    try {
        return (await fetch(baseUrl(), { signal: AbortSignal.timeout(3_000) })).ok;
    } catch {
        return false;
    }
}

let browser: Browser | undefined;
let started: Promise<void> | undefined;

/**
 * Connect the engine and launch the browser, once per process — the counterpart of @altea/altea's
 * `start()`, and memoised for the same reason: `node --test` gives each file its own process, so a
 * suite's `before` pays this once per FILE.
 *
 * No `headless` option: headless is the default, and a run you want to WATCH is `headless: false` with
 * `slowMo` here — the debug knob.
 */
export function start(): Promise<void> {
    return (started ??= (async () => {
        if (!hasStack) {
            console.warn(`[test] nothing is serving ${baseUrl()} — browser suites SKIP.`
                + ` Start one with: pnpm --filter eastwind stack <environment>`);
            return;
        }
        await startEngine();
        browser = await chromium.launch();
    })());
}

// Start and initialize the engine once, plus the lazy
// `DefaultBrowser`: both are ready before any test body runs, and both outlive every one of them.
// `browse` deliberately does NOT do this — the per-test restore below needs a connector too, so the
// engine cannot wait for the first browser.
beforeAll(async () => { await start(); });

// The per-test reset, and nothing about the browser — that is `browse`'s.
beforeEach(async () => {
    if (!hasStack)
        return;

    // What makes a test independent: whatever the last one created, filtered, renamed or deleted is gone
    // and the seed is back exactly as `gen:environment` left it. The
    // `Administrator.RestoreSnapshotOrDatabase()`, and the reason a suite may create rows freely and
    // never clean up.
    await Administrator.restoreSnapshotOrDatabase();

    const warning = await clearServerCaches();
    if (warning != null)
        console.warn(`[test] the server's caches were not cleared after the restore (${warning}).`
            + ` Is the stack running? (pnpm --filter eastwind stack <environment>)`);
});

afterAll(async () => {
    await browser?.close();
    browser = undefined;
    if (hasStack)
        await stopEngine();
});

/**
 * Open a browser AS someone, hand it to the closure, and close it however the closure ends.
 *
 * The proxy is created here and owned by the CLOSURE, not by a hook: a test says which user it is, its
 * browser lives exactly as long as its body, and the `finally` closes it on a failure as surely as on a
 * pass. That also means a test that never browses never opens one.
 *
 * A CONTEXT per call rather than just a page: the login token lives in storage, so dropping the context
 * is what makes the next `browse` start from logged-out.
 */
export async function browse(userName: TestUserName, action: (b: EastwindBrowser) => Promise<void>): Promise<void> {
    const context: BrowserContext = await browser!.newContext({ viewport: { width: 1280, height: 900 } });
    // A locator that never resolves should fail the test, not
    // hang the run.
    context.setDefaultTimeout(10_000);
    try {
        const b = new EastwindBrowser(await context.newPage());
        await b.loginAs(userName);
        await action(b);
    } finally {
        await context.close();
    }
}

/**
 * The five seeded users (see test/environment/eastwindEnvironment.ts). Each one's password IS its name,
 * so this is the whole credential — `await b().loginAs(TestUser.Standard)`.
 *
 * `Standard` / `Advanced` / `Super` have an EMPLOYEE linked; `System` and `Anonymous` do not, so anything
 * reading `EmployeeEntity.current()` (creating an order, for one) has to run as one of the first three.
 */
export const TestUser = {
    System: "System",
    Super: "Super",
    Advanced: "Advanced",
    Standard: "Standard",
    Anonymous: "Anonymous",
} as const;

export type TestUserName = typeof TestUser[keyof typeof TestUser];

/**
 * Run server-side work AS one of the seeded users.
 *
 * A suite arranges its data through the real domain (an operation, a save), and those read the ambient
 * user: the row-level type conditions gate on it, and `OrderOperation.CreateOrderFromCustomer` fills the
 * order's employee from its claim. Arranging as nobody would take a different path through the
 * application than the browser does.
 */
export async function asUser<R>(userName: TestUserName, fn: () => Promise<R>): Promise<R> {
    const user = await EastwindEnvironment.user(userName);
    return await UserHolder.withUser(new UserWithClaims(user), fn);
}
