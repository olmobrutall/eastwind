import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Client (SPA) bundle. Consumes the transformer-emitted JS of the core/spa
// layers (kept fresh by `tspc -b --watch`); Vite never runs the transformer.
//
// Dev topology (Southwind's Index.cshtml ViteDevServerPort model): the vite dev server serves the SPA
// and proxies /api to the eastwind API host (webServer.ts, default :3000), so the browser talks to one
// origin. In production the SPA is a built bundle served by the API host (Phase 4). Override the API
// target with VITE_API_TARGET.
const API_TARGET = process.env["VITE_API_TARGET"] ?? "http://localhost:3001";

// altea's client components import co-located ASSETS — a stylesheet (`import './Search.css'`) or a raw
// text file (`import './InitialWorkflow.xml?raw'`). tsc emits those imports into dist/client/*.js but does
// NOT copy the files there (tsc copies no assets). Rather than add a build-time copy step, resolve an asset
// imported from an altea workspace package's dist back to the co-located SOURCE file (dist/client/X.css →
// client/X.css). Covers ALL altea packages (@altea/altea, @altea/altea-auth, …). Dev + eastwind's own vite
// build only; a published package would ship its assets in dist instead.
const APP_ROOT = path.dirname(fileURLToPath(import.meta.url));
const ALTEA_WORKSPACE = path.resolve(APP_ROOT, "../altea");
const ASSET_EXTENSIONS = [".css", ".scss", ".xml", ".svg", ".txt", ".html"];

function isAsset(source: string): boolean {
    // Vite query suffixes (`?raw`, `?url`, `?inline`) are part of the specifier — strip before testing.
    const bare = source.split("?")[0];
    return ASSET_EXTENSIONS.some(ext => bare.endsWith(ext));
}

function alteaDistAssetToSource(): Plugin {
    return {
        name: "altea-dist-asset-to-source",
        enforce: "pre",
        resolveId(source, importer) {
            if (!isAsset(source))
                return null;
            // (a) The APP importing package CSS by specifier (`@altea/<pkg>/client/X.css`): map the scoped
            //     specifier to the workspace source dir. The package `exports` only map .js, so resolve here.
            if (source.startsWith("@altea/"))
                return path.join(ALTEA_WORKSPACE, source.slice("@altea/".length));
            // (b) A package's own co-located asset import emitted into its dist (dist/client/X.js →
            //     ./X.css): if the importer lives under an altea package's dist, resolve the sibling to
            //     source. ONLY for a RELATIVE specifier — a BARE one names another package
            //     (`bpmn-js/dist/assets/…/bpmn-embedded.css`), which node resolution must handle, and
            //     rewriting it as a sibling path is how it used to 404.
            //     APP_ROOT is in the same rule because eastwind's own emitted JS has the same problem:
            //     dist/app/main.client.js imports `./site.css`, which tsc did not copy next to it.
            if (importer == null || !(source.startsWith("./") || source.startsWith("../")))
                return null;
            const normImporter = path.normalize(importer);
            const inWorkspace = normImporter.startsWith(ALTEA_WORKSPACE) || normImporter.startsWith(APP_ROOT);
            if (!inWorkspace || !normImporter.includes(`${path.sep}dist${path.sep}`))
                return null;
            const [bare, query] = splitQuery(source);
            const abs = path.resolve(path.dirname(normImporter), bare);
            return abs.replace(`${path.sep}dist${path.sep}`, `${path.sep}`) + query;
        },
    };
}

function splitQuery(source: string): [string, string] {
    const i = source.indexOf("?");
    return i < 0 ? [source, ""] : [source.slice(0, i), source.slice(i)];
}

export default defineConfig({
    plugins: [alteaDistAssetToSource(), react()],
    // altea resolves types by CLASS NAME at runtime, and one of those lookups walks the prototype chain
    // comparing `ctor.name` against the framework's base classes (registration.ts's `inheritsFromNamed`).
    // A minifier renames a class it sees no other reference to, and `BaseEntity` is abstract, so in a
    // production build the chain read `CategoryEntity → Entity → Ar` and EVERY `Lite<T>` failed to
    // deserialize with `unknown type "…"`. Dev never showed it, because dev is unminified.
    // `registerType` already restores the name of each type it is given; this covers the ones it is not.
    esbuild: { keepNames: true },
    // The framework (@altea/altea/client) and the app both import react / react-router; they must
    // resolve to a SINGLE instance or React context (RouterProvider, etc.) won't cross the boundary.
    // fontawesome-svg-core is likewise a singleton: MainPublic's library.add(fas, far) must register
    // into the same registry the framework's <FontAwesomeIcon> reads, or string-named icons stay blank.
    resolve: { dedupe: ["react", "react-dom", "react-router", "@fortawesome/fontawesome-svg-core"] },
    server: {
        port: 5173,
        proxy: {
            "/api": { target: API_TARGET, changeOrigin: true, ws: true },
            // SERVER-RENDERED pages. The API host answers the DOCUMENT for these paths; every script and
            // stylesheet it points at is still served by Vite, because the browser only ever sees this
            // origin. That is what lets the SSR host stay a plain Express route instead of having to run
            // Vite in middleware mode. Add a path here when a page joins app/ssr.
            "/publicCatalog": { target: API_TARGET, changeOrigin: true },//PublicCatalog
        },
    },
    build: {
        outDir: "dist/client-bundle",
        emptyOutDir: true,
        // The SSR host resolves an entry's hashed file name (and its stylesheets) through this — see
        // SsrHost.assetUrl. Vite writes it to dist/client-bundle/.vite/manifest.json.
        manifest: true,//SSR
        rollupOptions: {
            // Two entries: index.html is the SPA, and each server-rendered page has its OWN small entry
            // that hydrates it — no auth, no route table, no framework UI kit. Listing it here is what
            // makes Vite emit it as a chunk of its own with its own CSS.
            input: {
                index: path.resolve(APP_ROOT, "index.html"),
                publicCatalog: path.resolve(APP_ROOT, "dist/app/publicApi/publicCatalogEntry.client.js"),//PublicCatalog
            },
        },//SSR
    },
});
