import { defineConfig } from "vite";
import { chainEmittedSourcemaps } from "./vite.emittedJs";

// Server bundle. Runs AFTER `tspc -b` has emitted the transformed logic JS.
// Vite/Rollup bundles the emitted plain JS (logic + entities layers, plus the
// @altea/* workspace packages) into one flat ESM file — no raw .ts or
// per-package dist resolution at runtime.
export default defineConfig({
    plugins: [chainEmittedSourcemaps()],
    build: {
        ssr: "dist/webServer.server.js",
        outDir: "dist/server-bundle",
        emptyOutDir: true,
        target: "node22",
        sourcemap: true, // map the bundle back to logic/main.ts etc. for debugging
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
