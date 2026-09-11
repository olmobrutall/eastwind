import { test as base } from "@playwright/test";
import { Administrator } from "@altea/altea/server/Administrator";
import { UserHolder } from "@altea/altea/server/userHolder";
import { UserWithClaims } from "@altea/altea/data/security";
import { EastwindBrowser } from "./eastwindBrowser";
import { EastwindEnvironment } from "./environment/eastwindEnvironment";
import { startEngine, stopEngine } from "./testDatabase";
import { clearServerCaches } from "./appStack";

// The fixtures every spec runs on — Signum's `SouthwindTestClass`, which is a base class there and a set
// of Playwright fixtures here.
//
//   engine    (worker) — build the schema + bind the connector once, so a spec can query and save.
//   database  (test)   — restore the snapshot before EVERY test, then clear the server's caches.
//   b         (test)   — the browser proxy for this test's page.
//
// `database` is what makes a test independent: whatever the last one created, filtered, renamed or
// deleted is gone, and the seed is back exactly as `gen:environment` left it. That is Signum's
// `Administrator.RestoreSnapshotOrDatabase()` in `InitializeAsync`, and it is the reason a spec may
// create rows freely and never clean up.

export const test = base.extend<{ b: EastwindBrowser; database: void }, { engine: void }>({

    engine: [async ({}, use) => {
        await startEngine();
        await use();
        await stopEngine();
    }, { scope: "worker", auto: true }],

    database: [async ({ engine: _engine }, use) => {
        await Administrator.restoreSnapshotOrDatabase();

        const warning = await clearServerCaches();
        if (warning != null)
            console.warn(`[test] the server's caches were not cleared after the restore (${warning}).`
                + ` Is the stack running? (pnpm --filter eastwind stack <environment>)`);

        await use();
    }, { auto: true }],

    b: async ({ page }, use) => {
        await use(new EastwindBrowser(page));
    },
});

export { expect } from "@playwright/test";

/**
 * The five seeded users (see test/environment/eastwindEnvironment.ts). Each one's password IS its name,
 * so this is the whole credential — `await b.loginAs(TestUser.Standard)`.
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
 * Run server-side work AS one of the seeded users — Signum's `AuthLogic.UnsafeUserSession(userName)`.
 *
 * A spec arranges its data through the real domain (an operation, a save), and those read the ambient
 * user: the row-level type conditions gate on it, and `OrderOperation.CreateOrderFromCustomer` fills the
 * order's employee from its claim. Arranging as nobody would take a different path through the
 * application than the browser does.
 */
export async function asUser<R>(userName: TestUserName, fn: () => Promise<R>): Promise<R> {
    const user = await EastwindEnvironment.user(userName);
    return await UserHolder.withUser(new UserWithClaims(user), fn);
}
