import { defineConfig } from "@playwright/test";

// Playwright runs the COMPILED suites (dist/test/**), not the .ts: the specs use property LAMBDAS, which
// only mean anything after the quote-transformer has stamped them (`tspc -b`) — Playwright's own esbuild
// transform would strip them silently. `pnpm --filter eastwind test <environment>` builds first for that
// reason, and loads that environment's `.env` file so the suite reaches the same database the stack under
// test is serving.
export default defineConfig({
    testDir: "./dist/test",
    testMatch: "**/*.spec.js",
    // NOT parallel, and not negotiable: every test restores the whole database from the snapshot
    // (test/fixtures.ts), which is a database-wide operation. Two workers would rewind each other.
    fullyParallel: false,
    workers: 1,
    reporter: [["list"]],
    use: {
        baseURL: process.env["EASTWIND_URL"] ?? "http://localhost:5173/",
        trace: "retain-on-failure",
        viewport: { width: 1280, height: 900 },
    },
});
