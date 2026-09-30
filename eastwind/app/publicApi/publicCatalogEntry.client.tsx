import * as React from "react";
import { hydrateRoot } from "react-dom/client";
import "bootstrap/dist/css/bootstrap.min.css";
import "../site.css";
import { Serializer } from "@altea/altea/data/serializer";
import { loadReflectionMetadata } from "@altea/altea/client/ReflectionClient";
import PublicCatalog from "./PublicCatalog";
import { CategoryEntity, ProductEntity } from "../products/Product.data";
import type { PublicCatalogData } from "./PublicCatalog.data";

/**
 * The entity types the payload contains, named here so they reach the bundle.
 *
 * `Serializer.parse` resolves `{"$lite":"Category"}` and the product rows through the type registry that
 * DECLARING these classes fills, and it looks them up BY STRING — which is invisible to a bundler. The view
 * imports only `CatalogMessage` out of that module, so a production build tree-shook both classes away and
 * hydration died with `Cannot deserialize lite: unknown type "Category"`. It worked in dev the whole time,
 * because Vite serves modules unshaken; this is a build-only failure, which is why the check is explicit.
 */
const payloadTypes = [CategoryEntity, ProductEntity];

// The client entry of the SERVER-RENDERED catalog — the whole of it. Compare with main.client.ts, which
// boots the SPA: this page carries no auth, no route table, no admin tree and no framework UI kit, which
// is the point. The markup is already on screen when this module starts; all it does is make it live.
//
// Two things have to happen in order, and the order is the whole trick:
//
//  1. The payload is revived with `Serializer.parse`, not `JSON.parse`. What the server embedded contains
//     real `Lite<CategoryEntity>` values and `ProductEntity` rows, and the view calls `c.category.key()` —
//     a method, which a plain JSON object does not have. This is the same codec `ajaxGet` uses, so the
//     objects are indistinguishable from fetched ones.
//
//  2. The reflection METADATA is loaded, for the culture the server rendered in, BEFORE hydrating. The
//     view's column headers are `niceToString()` calls: with no metadata they fall back to the code-declared
//     English defaults, so hydrating first and loading second would swap every heading under React and
//     report a mismatch. One request, and the markup stays interactive-in-waiting until it lands — which
//     is exactly the trade SSR makes.
async function boot(): Promise<void> {

    if (payloadTypes.some(t => t == null))
        throw new Error("publicCatalogEntry: the catalog's entity types did not reach the bundle.");

    const el = document.getElementById("ssr-payload");
    const root = document.getElementById("root");
    if (el == null || root == null)
        throw new Error("publicCatalogEntry: the document is not a server-rendered one (no #ssr-payload).");

    const { culture, payload } = Serializer.parse(el.textContent!) as { culture: string; payload: PublicCatalogData };

    await loadReflectionMetadata({ culture });

    hydrateRoot(root, <PublicCatalog data={payload} />);
}

void boot().catch(err => {
    // A failed hydration leaves the server's markup on screen — readable, just not interactive — so this
    // logs rather than replacing a working page with an error.
    console.error("[publicCatalog] hydration failed:", err);
});
