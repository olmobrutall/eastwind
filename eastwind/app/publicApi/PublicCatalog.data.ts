import type { Lite } from "@altea/altea/data/lite";
import type { CategoryEntity, ProductEntity } from "../products/Product.data";

// The wire shape of the ANONYMOUS public catalog, shared by the server and PublicCatalog.tsx.
//
// It lives in the DATA layer because both halves need it and the client may not reference `server/` — the
// same call @altea/altea-whats-new makes for its DTOs. Nothing here is an entity of its own: `category` and
// `products` ARE real entities/lites, which the client's `Serializer.parse` revives (`ajaxGet` deserializes
// with the Serializer by default), and the category picture travels as a URL rather than as its bytes —
// see `pictureUrl` for why that matters once the page is server-rendered.
export interface CategoryWithProducts {
    category: Lite<CategoryEntity>;
    /**
     * Where to GET the category picture, or null when it has none.
     *
     * A URL and not the bytes: the page that renders this is SERVER-RENDERED, so base64 in here would
     * travel twice — once inside the markup as a data: url and once again in the hydration payload the
     * same markup is rebuilt from. With eight Northwind categories that was 5.3MB of document. As a url
     * the browser fetches each picture once, in parallel, cached, and off the critical path.
     */
    pictureUrl: string | null;
    locCategoryName: string;
    locDescription: string;
    products: ProductEntity[];
}

/**
 * Everything the catalog view renders, as ONE prop object — the shape the server-rendered document embeds
 * and the hydration entry reads back.
 *
 * `culture` and `baseName` are in here rather than read from ambient state on each tier because the two
 * renders have to agree EXACTLY: the server resolves the culture from the request (cookie → user →
 * Accept-Language) and knows its own base path, and the client must format and link with those same two
 * values rather than with whatever it would have guessed for itself.
 */
export interface PublicCatalogData {
    categories: CategoryWithProducts[];
    /** The culture the server rendered in; the entry loads the metadata for it before hydrating. */
    culture: string;
    /** The application's base path, as `window.__baseName` — "" for a root deployment. */
    baseName: string;
}
