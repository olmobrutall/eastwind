import { defineConfig } from "vite";
import { chainEmittedSourcemaps } from "./vite.emittedJs";

// Terminal bundle. Runs AFTER `tspc -b` has emitted the transformed JS — the quote-transformer's `__quoted`
// trees exist only in tspc output, so the bundler consumes dist/*.js and NEVER the .ts (vite's own esbuild
// transform would strip them silently, the same trap the e2e suite avoids by pointing Playwright at dist).
//
// Why bundle: the terminal host loads ~2.4k separate dist modules before its first statement runs. On
// Windows that costs seconds — 7.8k module resolutions plus the on-access virus scan, which is ~5ms per
// file whenever its scan cache is cold. One flat ESM file removes that surface, and node needs no
// `--import @altea/altea/register.mjs` to run it either: every extensionless relative import is resolved at
// BUILD time, so the loader hook has nothing left to fix up.
//
// Only the workspace is bundled; node_modules stays external (vite's ssr default), so `pg` and friends are
// still resolved and loaded by node at runtime.
//
// This build should report NO "dynamically imported by X but also statically imported by Y" warning. Each
// one is a real finding: a workspace module dynamically importing something the same graph already loads
// eagerly buys nothing, costs a promise per call, and tells the reader a lie about what is deferred. The
// two connectors and altea-cache's PostgresBroadcast ARE deferred on purpose — they pull the `pg` / `mssql`
// driver, so only the configured dialect's chunk is ever loaded — and a warning naming one of them means
// something started importing it eagerly again.
export default defineConfig({
    plugins: [chainEmittedSourcemaps({ pinImportMetaUrl: true })],
    build: {
        ssr: "dist/terminal/terminal.js",
        outDir: "dist/terminal-bundle",
        emptyOutDir: true,
        target: "node22",
        sourcemap: true, // chained back to terminal.ts etc. for debugging
        rollupOptions: {
            output: { entryFileNames: "main.js" },
        },
    },
    ssr: {
        // Bundle workspace packages into the artifact; keep native/runtime deps external.
        noExternal: [/@altea\//, /^eastwind\//],
        external: ["pg"],
    },
});
