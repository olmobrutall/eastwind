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

// altea's client components import co-located stylesheets (`import './Search.css'`). tsc emits those
// imports into dist/client/*.js but does NOT copy the .css files there (tsc copies no assets). Rather
// than add a build-time copy step, resolve any .css/.scss imported from altea's dist back to the
// co-located SOURCE file (dist/client/X.css -> client/X.css). Dev + eastwind's own vite build only; a
// published @altea/altea would ship its CSS in dist instead.
const ALTEA_SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../altea/altea");
function alteaDistCssToSource(): Plugin {
    const DIST = `${path.sep}altea${path.sep}altea${path.sep}dist${path.sep}`;
    const ALTEA_PKG = "@altea/altea/";
    return {
        name: "altea-dist-css-to-source",
        enforce: "pre",
        resolveId(source, importer) {
            if (!(source.endsWith(".css") || source.endsWith(".scss")))
                return null;
            // (a) The APP importing framework CSS by package specifier (like Southwind's
            //     `import "@framework/Frames/Frames.css"`): @altea/altea/client/X.css → altea source.
            //     tsc doesn't emit CSS into dist, and the package `exports` only map .js, so resolve here.
            if (source.startsWith(ALTEA_PKG))
                return path.join(ALTEA_SRC_ROOT, source.slice(ALTEA_PKG.length));
            // (b) altea's own co-located CSS import emitted into dist (dist/client/X.js → ./X.css) → source.
            if (importer == null)
                return null;
            const normImporter = path.normalize(importer);
            if (!normImporter.includes(DIST))
                return null;
            const abs = path.resolve(path.dirname(normImporter), source);
            return abs.replace(`${path.sep}dist${path.sep}`, `${path.sep}`);
        },
    };
}

export default defineConfig({
    plugins: [alteaDistCssToSource(), react()],
    // The framework (@altea/altea/client) and the app both import react / react-router; they must
    // resolve to a SINGLE instance or React context (RouterProvider, etc.) won't cross the boundary.
    // fontawesome-svg-core is likewise a singleton: MainPublic's library.add(fas, far) must register
    // into the same registry the framework's <FontAwesomeIcon> reads, or string-named icons stay blank.
    resolve: { dedupe: ["react", "react-dom", "react-router", "@fortawesome/fontawesome-svg-core"] },
    server: {
        port: 5173,
        proxy: {
            "/api": { target: API_TARGET, changeOrigin: true },
        },
    },
    build: {
        outDir: "dist/client-bundle",
        emptyOutDir: true,
    },
});
