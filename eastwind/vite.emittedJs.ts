import type { Plugin } from "vite";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

// Two-stage build: tspc emits .js + .js.map (mapping to the .ts source), then
// Vite bundles the .js. This plugin feeds each emitted .js.map into Rollup so
// the final bundle sourcemap *chains* back to the original .ts files — letting
// you set breakpoints in logic/main.ts (not the dist .js).
//
// `pinImportMetaUrl` additionally rewrites each module's `import.meta.url` to the URL it had BEFORE
// bundling. A bundler collapses every module into one file, so Rollup resolves `import.meta.url` to the
// BUNDLE's location — which silently relocates every resource a package reads relative to itself:
// altea-agent's Skills/, altea-chart's Icons/, altea-office-template's plainExcelTemplate.xlsx, eastwind's
// own eval typesPath. Pinning keeps each of those reads pointing at the package's own dist. The trade-off is
// that the bundle then carries absolute paths from the machine that built it — a local run artifact, not
// something to copy elsewhere — so only the terminal bundle asks for it.
export function chainEmittedSourcemaps(options: { pinImportMetaUrl?: boolean } = {}): Plugin {
    return {
        name: "chain-emitted-sourcemaps",
        load(id) {
            if (!id.endsWith(".js")) return null;
            const mapPath = id + ".map";
            const hasMap = fs.existsSync(mapPath);
            if (!hasMap && !options.pinImportMetaUrl) return null;

            const emitted = fs.readFileSync(id, "utf8");
            if (!hasMap && !emitted.includes("import.meta.url")) return null;

            // Substituted in the load hook rather than in a transform, so the emitted map still describes
            // the code Rollup sees. The literal is longer than the expression it replaces, so columns AFTER
            // it on that one line shift — acceptable for the handful of modules that read a resource this
            // way, and the alternative (a transform returning no map) breaks the chain for the whole module.
            const code = options.pinImportMetaUrl
                ? emitted.replaceAll("import.meta.url", JSON.stringify(pathToFileURL(id).href))
                : emitted;

            return { code, map: hasMap ? JSON.parse(fs.readFileSync(mapPath, "utf8")) : null };
        },
    };
}
