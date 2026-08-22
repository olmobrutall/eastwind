import { defineConfig } from "@playwright/test";

// Playwright runs the COMPILED suites (dist/test/**), not the .ts: the specs use property LAMBDAS, which
// only mean anything after the quote-transformer has stamped them (`tspc -b`) — Playwright's own esbuild
// transform would strip them silently. `pnpm test:e2e` builds first for that reason.
export default defineConfig({
    testDir: "./dist/test",
    testMatch: "**/*.spec.js",
    fullyParallel: false,
    reporter: [["list"]],
    use: {
        baseURL: process.env["EASTWIND_E2E_URL"] ?? "http://localhost:5173/",
        trace: "retain-on-failure",
        viewport: { width: 1280, height: 900 },
    },
});
