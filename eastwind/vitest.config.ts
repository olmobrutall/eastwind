import { alteaVitestConfig } from "@altea/altea/vitest.shared.mjs";

// `.env.local` is the default environment; `--mode <name>` loads `.env.<name>` instead, which is how
// `pnpm --filter eastwind test dev` reaches `.env.dev` (see scripts/withEnv.mjs).
export default alteaVitestConfig(import.meta.url, { envFile: ".env.local" });
