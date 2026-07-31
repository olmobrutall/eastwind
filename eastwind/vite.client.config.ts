import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Client (SPA) bundle. Consumes the transformer-emitted JS of the core/spa
// layers (kept fresh by `tspc -b --watch`); Vite never runs the transformer.
//
// Dev topology (Southwind's Index.cshtml ViteDevServerPort model): the vite dev server serves the SPA
// and proxies /api to the eastwind API host (webServer.ts, default :3000), so the browser talks to one
// origin. In production the SPA is a built bundle served by the API host (Phase 4). Override the API
// target with VITE_API_TARGET.
const API_TARGET = process.env["VITE_API_TARGET"] ?? "http://localhost:3000";

// altea's client components import co-located stylesheets (`import './Search.css'`). tsc emits those
// imports into dist/client/*.js but does NOT copy the .css files there (tsc copies no assets). Rather
// than add a build-time copy step, resolve any .css/.scss imported from altea's dist back to the
// co-located SOURCE file (dist/client/X.css -> client/X.css). Dev + eastwind's own vite build only; a
// published @altea/altea would ship its CSS in dist instead.
function alteaDistCssToSource(): Plugin {
    const DIST = `${path.sep}altea${path.sep}altea${path.sep}dist${path.sep}`;
    return {
        name: "altea-dist-css-to-source",
        enforce: "pre",
        resolveId(source, importer) {
            if (importer == null || !(source.endsWith(".css") || source.endsWith(".scss")))
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
    resolve: { dedupe: ["react", "react-dom", "react-router"] },
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
