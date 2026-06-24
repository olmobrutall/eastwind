import { defineConfig, type Plugin } from "vite";
import fs from "node:fs";

// Two-stage build: tspc emits .js + .js.map (mapping to the .ts source), then
// Vite bundles the .js. This plugin feeds each emitted .js.map into Rollup so
// the final bundle sourcemap *chains* back to the original .ts files — letting
// you set breakpoints in logic/main.ts (not the dist .js).
function chainEmittedSourcemaps(): Plugin {
    return {
        name: "chain-emitted-sourcemaps",
        load(id) {
            if (!id.endsWith(".js")) return null;
            const mapPath = id + ".map";
            if (!fs.existsSync(mapPath)) return null;
            return {
                code: fs.readFileSync(id, "utf8"),
                map: JSON.parse(fs.readFileSync(mapPath, "utf8")),
            };
        },
    };
}

// Server bundle. Runs AFTER `tspc -b` has emitted the transformed logic JS.
// Vite/Rollup bundles the emitted plain JS (logic + entities layers, plus the
// @altea/* workspace packages) into one flat ESM file — no raw .ts or
// per-package dist resolution at runtime.
export default defineConfig({
    plugins: [chainEmittedSourcemaps()],
    build: {
        ssr: "dist/logic/main.js",
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
        noExternal: [/@altea\//, /^my-app\//],
        external: ["pg"],
    },
});
