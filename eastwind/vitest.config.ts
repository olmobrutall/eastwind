import { alteaVitestConfig } from "@altea/altea/vitest.shared.mjs";

// `.env.local` is the default environment; `--mode <name>` loads `.env.<name>` instead, which is how
// `pnpm --filter eastwind test dev` reaches `.env.dev` (see scripts/withEnv.mjs).
//
// The browser suites need a longer leash than the shared default: a single test restores the database,
// logs in, and then drives a real UI through a dozen round trips, which is minutes of work on a cold
// stack and nothing like the milliseconds a logic test takes.
export default alteaVitestConfig(import.meta.url, {
    envFile: ".env.local",
    test: { testTimeout: 180_000, hookTimeout: 180_000 },
});
