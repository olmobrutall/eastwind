import { extname, resolve } from "node:path";
import express from "express";
import type { WebBuilder } from "@altea/altea/server/webApi";

// Serving the SPA itself — the client bundle's assets, and the document behind them.
//
// In DEV none of this mounts: Vite is the origin, serves index.html and every module, and proxies only
// `/api` (and any server-rendered path) to this host. In a BUILD there is no Vite, so someone has to do
// Vite's job, and that is all this file is.
//
// It is deliberately NOT part of the SSR module. Server-side rendering is optional — most applications
// render everything in the SPA — but every application has to serve its own SPA, so a scaffolded app that
// unticks SSR must keep this. It lived inside SsrHost for one afternoon and removing SSR took the app's
// ability to answer `/` with it.
export namespace SpaHost {

    const CLIENT_BUNDLE = "dist/client-bundle";

    const isDev = process.env["NODE_ENV"] !== "production";

    /**
     * Call it from the web host AFTER every module has registered — both handlers below are catch-alls,
     * so anything registered later is unreachable, and anything registered earlier (every `/api` route,
     * and each server-rendered page) wins. That order is what makes a catch-all safe here.
     */
    export function start(ws: WebBuilder): void {
        if (isDev)
            return;

        ws.app.use(express.static(CLIENT_BUNDLE, { index: false }));

        // The SPA history fallback. Without it a build answers only the paths something registered — so
        // `/` and every client route like `/auth/login` came back 404, because those routes exist solely
        // inside the router the SPA builds after it boots. `index: false` above is deliberate: `/` comes
        // through here too, so the document is served from one place with one set of headers.
        ws.app.use((req, res, next) => {
            if (req.method !== "GET" && req.method !== "HEAD")
                return next();
            // An API path that reached here matched no route: let it 404 as itself, not as a page.
            if (req.path.startsWith("/api/"))
                return next();
            // A request for a FILE that static did not find must 404, not be answered with HTML. A missing
            // chunk served as a document fails later and further away, as a module parse error.
            if (extname(req.path) !== "")
                return next();
            if (!req.accepts("html"))
                return next();
            // Never cached: it names this build's hashed chunks, and a stale copy points at files that the
            // next deploy deleted. The chunks themselves are immutable and cache on their own names.
            res.setHeader("Cache-Control", "no-cache");
            res.sendFile(resolve(CLIENT_BUNDLE, "index.html"));
        });
    }
}
