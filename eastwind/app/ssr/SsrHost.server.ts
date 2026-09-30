import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Request, Response } from "express";
import { CultureInfo } from "@altea/altea/data/utils/cultureInfo";
import { Serializer } from "@altea/altea/data/serializer";
import { requestCulture } from "@altea/altea/server/filters/cultureFilter";
import { InitializeGate } from "@altea/altea/server/filters/initializeGate";
import type { WebBuilder } from "@altea/altea/server/webApi";

// The SERVER-SIDE RENDERING host — the common infrastructure every SSR page in the application shares,
// and the only file that knows how a document is assembled. A page contributes a payload and a component;
// everything below (the shell, the culture scope, the hydration channel, where the scripts come from in
// dev versus a build) is decided once, here.
//
// Why a page is server-rendered at all: the SPA answers an anonymous visitor only after it has fetched the
// deployment mode, resolved the stored token, asked each directory authenticator for its configuration and
// downloaded the reflection metadata — four or five round trips before the first pixel. A shop window
// cannot afford that, and a crawler will not wait for it.
//
// Worth knowing:
//  - an SSR page is NOT a route of the SPA. It is its own document with its own small entry bundle, so it
//    carries none of the admin tree, no auth and no metadata blob. That is what makes it fast, and it is
//    also what makes hydration CORRECT: the SPA builds its route table at runtime from who is logged in
//    (MainPublic's `reload`), so its first client render could never be guaranteed to match server markup.
//  - the document is index.html, the very same shell the SPA uses, with the rendered markup spliced into
//    `#root`. One shell, so the theme bootstrap and the splash keep working unchanged.
//  - in dev the browser still talks to VITE (port 5173+), which proxies this route back to the API host —
//    see vite.client.config.ts. So the script urls below are same-origin either way and Vite serves them.
//  - this file is ORDINARY SERVER CODE. Only the React-to-string step spans both tiers, and that lives in
//    the tiny *.ssr.ts layer (see tsconfig.ssr.json); a page hands its already-rendered markup to `page`
//    below. Keeping the split here is what lets the server project reference the SSR one without the
//    circular project reference the other arrangement would need.
export namespace SsrHost {

    /** What a page hands back: the markup to splice in, and the payload its entry rehydrates from. */
    export interface RenderResult {
        html: string;
        /** Serialized with the entity codec, so a `Lite`/entity in the payload revives on the client. */
        payload: unknown;
    }

    export interface PageOptions {
        /** The url path the document answers on, e.g. `/publicCatalog`. */
        path: string;
        /**
         * The page's own client entry, as the path Vite serves it from — the emitted module, exactly like
         * index.html's own `/dist/app/main.client.js`. It is what calls `hydrateRoot`.
         */
        entry: string;
        /** Everything variable about the document head. */
        title: string;
        render: (req: Request, culture: string) => Promise<RenderResult>;
    }

    /** Vite's dev server is the origin in development; a build is served by this host itself. */
    const isDev = process.env["NODE_ENV"] !== "production";

    // The shell, read once — the SOURCE index.html in both modes, never the built copy in the client
    // bundle. The built one has had Vite's own <script>/<link> tags for the SPA spliced in and the
    // `/dist/app/main.client.js` marker below rewritten away, so a page assembled from it silently kept
    // the SPA's bundle and dropped its own. The source shell has one stable marker and no asset urls at
    // all; where THIS page's assets come from is the manifest's job (see assetUrl / entryStyles).
    //
    // It follows that index.html has to ship beside the server bundle, next to its working directory.
    let shell: string | undefined;
    function documentShell(): string {
        shell ??= readFileSync("index.html", "utf8");
        return shell;
    }

    const CLIENT_BUNDLE = "dist/client-bundle";

    /**
     * Register one server-rendered page.
     *
     * The handler is deliberately NOT a `ws.get` route: those answer `res.jsonTyped` through the api
     * pipeline and carry the route-level auth gate. A document is anonymous by construction and answers
     * HTML, so it is mounted on Express directly — but it opens the SAME two scopes an api call gets, the
     * initialize gate (a database that was down at boot must fail THIS request, not the process) and the
     * request culture.
     */
    export function page(ws: WebBuilder, options: PageOptions): void {
        ws.app.get(options.path, (req, res) => {
            void handle(req, res, options);
        });
    }

    async function handle(req: Request, res: Response, options: PageOptions): Promise<void> {
        try {
            await InitializeGate.ensure();
            // Signum's culture chain, the same one every api call runs through (cookie → user →
            // Accept-Language → default). BOTH cultures are scoped, because the markup this produces
            // contains formatted numbers as well as translated names — and the culture travels to the
            // client in the payload so its hydration pass resolves to the very same strings.
            const culture = requestCulture(req);
            const result = await CultureInfo.withCultures(culture, () => options.render(req, culture));
            res.status(200).type("html").send(document(result, culture, options));
        } catch (e) {
            // No partial document: a half-rendered page would hydrate into something that is not what the
            // server meant. The message is the framework's, and the SPA shell still boots from /.
            console.error(`[ssr] ${options.path} failed:`, e);
            res.status(500).type("text/plain").send("Server-side rendering failed; see the server log.");
        }
    }

    function document(result: RenderResult, culture: string, options: PageOptions): string {
        const data = { culture, payload: result.payload };
        return documentShell()
            .replace("<title>eastwind</title>", `<title>${escapeHtml(options.title)}</title>`)
            // A built entry's stylesheets, in the head so the page arrives styled rather than flashing
            // unstyled while the module graph loads them. Empty in dev, where Vite injects them itself.
            .replace("</head>", `${entryStyles(options.entry)}\n  </head>`)
            // The splash is for the SPA, which paints nothing for seconds. This page arrives painted.
            .replace(`<div id="app-splash"`, `<div id="app-splash" hidden`)
            .replace(`<div id="root"></div>`, `<div id="root">${result.html}</div>`)
            // The SPA's own module must not run here: this document is not the SPA.
            .replace(`<script type="module" src="/dist/app/main.client.js"></script>`,
                `${hydrationPayload(data)}\n    ${devPreamble()}\n    <script type="module" src="${assetUrl(options.entry)}"></script>`);
    }

    /**
     * The payload, as data rather than as code: a `type="application/json"` block the entry reads back,
     * not a `window.x = …` assignment. Only `<` has to be neutralised then, and it is neutralised
     * unconditionally — a product name containing `</script>` would otherwise end the block early, which
     * is a script-injection hole and not merely a rendering bug.
     */
    function hydrationPayload(data: unknown): string {
        const json = Serializer.stringify(data).replaceAll("<", "\\u003c");
        return `<script type="application/json" id="ssr-payload">${json}</script>`;
    }

    /**
     * `@vitejs/plugin-react` injects this into index.html itself; a document assembled here has to carry
     * it, or every component Vite transformed for Fast Refresh throws "can't detect preamble" on load.
     * Vite serves both urls, and in dev Vite is the origin the browser sees.
     */
    function devPreamble(): string {
        if (!isDev)
            return "";
        return `<script type="module">
      import RefreshRuntime from "/@react-refresh";
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    </script>
    <script type="module" src="/@vite/client"></script>`;
    }

    /**
     * In dev the entry IS the emitted module path, which Vite serves and transforms on the fly. A build
     * hashes it, so the name is looked up in the manifest Vite writes — and its stylesheets come back with
     * it, since nothing else in this document would pull them in.
     */
    function assetUrl(entry: string): string {
        if (isDev)
            return entry;
        const entry2 = entry.replace(/^\//, "");
        const chunk = manifest()[entry2];
        if (chunk == null)
            throw new Error(`[ssr] ${entry2} is not in ${CLIENT_BUNDLE}/.vite/manifest.json — is it listed in vite.client.config.ts's build.rollupOptions.input?`);
        return "/" + chunk.file;
    }

    /**
     * The stylesheets a built entry needs, as <link> tags — dev gets them from the module graph instead.
     *
     * Walked TRANSITIVELY through `imports`, because a stylesheet is attributed to the chunk that imports
     * it and rollup puts shared code in its own chunks: this page's entry is a couple of kB and every one
     * of its stylesheets, bootstrap included, hangs off a chunk it merely imports. Reading `css` off the
     * entry alone found nothing and the built page came up unstyled.
     */
    function entryStyles(entry: string): string {
        if (isDev)
            return "";
        const seen = new Set<string>();
        const css = new Set<string>();
        const walk = (key: string): void => {
            if (seen.has(key))
                return;
            seen.add(key);
            const chunk = manifest()[key];
            chunk?.css?.forEach(f => css.add(f));
            chunk?.imports?.forEach(walk);
        };
        walk(entry.replace(/^\//, ""));
        return [...css].map(f => `<link rel="stylesheet" href="/${f}">`).join("\n    ");
    }

    interface ManifestChunk { file: string; css?: string[]; imports?: string[] }
    let _manifest: Record<string, ManifestChunk> | undefined;
    function manifest(): Record<string, ManifestChunk> {
        _manifest ??= JSON.parse(readFileSync(join(CLIENT_BUNDLE, ".vite", "manifest.json"), "utf8")) as Record<string, ManifestChunk>;
        return _manifest;
    }

    function escapeHtml(s: string): string {
        return s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    }
}
