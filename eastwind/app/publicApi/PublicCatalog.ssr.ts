import { createElement } from "react";
import { renderToString } from "react-dom/server";
import PublicCatalog from "./PublicCatalog";
import type { PublicCatalogData } from "./PublicCatalog.data";

// The one step of server-side rendering that genuinely spans both tiers: turning the CLIENT layer's
// catalog component into an HTML string on node. Everything else about the page — loading the payload,
// assembling the document, mounting the route — is ordinary server code and lives beside it in
// PublicCatalog.server.ts, which imports this.
//
// It is this small on purpose. `tsconfig.ssr.json` is the only project in the application allowed to see
// both layers (it clears the `altea-server` export condition that stops a *.server.ts importing
// `@altea/<pkg>/client/X`), so the less that lives inside it, the less escapes the tier guard. Its whole
// exported surface is `(data) => string`, which keeps the server project's import of it tier-neutral.
//
// `createElement` rather than JSX, because the file has to stay a `.ts`: the client preset globs every
// `.tsx` under the app, so a `PublicCatalog.ssr.tsx` would be compiled into two projects at once.
//
// It also must NOT live in the client layer, even though it could compile there: `react-dom/server` would
// then be reachable from the SPA's module graph and Vite would bundle a server renderer into the browser.
export function renderPublicCatalog(data: PublicCatalogData): string {
    return renderToString(createElement(PublicCatalog, { data }));
}
