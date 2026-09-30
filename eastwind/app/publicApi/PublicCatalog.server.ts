import "@altea/altea/server";
import { WebBuilder, CustomType } from "@altea/altea/server/webApi";
import { PropertyRoute } from "@altea/altea/data/propertyRoute";
import { PropertyRouteTranslationLogic } from "@altea/altea/server/propertyRouteTranslation";
import { retrieve } from "@altea/altea/server/Database";
import { CategoryEntity } from "../products/Product.data";
import { ProductsLogic } from "../products/ProductLogic.server";
import { SsrHost } from "../ssr/SsrHost.server";
import { renderPublicCatalog } from "./PublicCatalog.ssr";
import type { CategoryWithProducts, PublicCatalogData } from "./PublicCatalog.data";

// The ANONYMOUS catalog the public landing page reads
// (publicApi/PublicCatalog.tsx). The OTHER catalog surface, the API-key-authenticated one that
// @altea/altea-rest logs, is CatalogApi.server.ts beside this file.
//
// Worth knowing:
//  - the route is `/api/publicCatalog`, not `/api/catalog`. CatalogApi mounts its RestLog middleware on the
//    `/api/catalog` PREFIX (an Express `use` covers the prefix itself), so keeping the upstream path would
//    write a RestLog row for every anonymous page view — the opposite of what that log is for.
//  - `PropertyRouteTranslationLogic.translatedField` takes three arguments here, not four: altea resolves
//    the culture from the request scope (the `Accept-Language` tag every call carries) rather than from a
//    `CultureInfo?` parameter.
export namespace PublicCatalogApi {

    // The two static PropertyRoutes. Built lazily rather than at module scope: a route resolves
    // through the reflection metadata, which is not stamped until the entity modules have loaded.
    let prCategoryName: PropertyRoute;
    let prDescription: PropertyRoute;

    export function start(ws: WebBuilder): void {

        prCategoryName = PropertyRoute.root(CategoryEntity).addLambda(a => a.categoryName);
        prDescription = PropertyRoute.root(CategoryEntity).addLambda(a => a.description);

        // Allow-anonymous: the landing page shows this to a visitor who has never logged
        // in. Everything it returns is public product data.
        ws.get("/api/publicCatalog",
            { res: CustomType<CategoryWithProducts[]>(), allowAnonymous: true },
            async (_req, res) => res.jsonTyped(await categoriesWithProducts()));

        // One category picture, addressed by the url `categoriesWithProducts` hands out. Anonymous for the
        // same reason the catalog is, and immutable for a day: the bytes only change when someone edits the
        // category, and a stale thumbnail on a shop window is cheaper than eight uncached round trips.
        ws.app.get("/api/publicCatalog/picture/:id", (req, res) => {
            void (async () => {
                const category = await retrieve(CategoryEntity, Number(req.params["id"]));
                const picture = category.picture;
                if (picture == null) {
                    res.sendStatus(404);
                    return;
                }
                res.type(mimeTypeOf(picture.fileName))
                    .setHeader("Cache-Control", "public, max-age=86400");
                res.send(Buffer.from(picture.binaryFile));
            })().catch(() => res.sendStatus(404));
        });

        // The SERVER-RENDERED page at `/publicCatalog`, which is what a visitor actually opens — the JSON
        // endpoint above is the same data for any other caller. `baseName` is the value index.html injects
        // as `window.__baseName`; it travels in the payload instead of being read on each tier, so the two
        // renders cannot disagree about a link or a background url and trip hydration.
        SsrHost.page(ws, {
            path: "/publicCatalog",
            entry: "/dist/app/publicApi/publicCatalogEntry.client.js",
            title: "eastwind Product Catalog",
            render: async (_req, culture) => {
                const data: PublicCatalogData = { categories: await categoriesWithProducts(), culture, baseName: "" };
                return { html: renderPublicCatalog(data), payload: data };
            },
        });
    }

    /**
     * The payload itself, so the SERVER-RENDERED page can build it without going through HTTP to reach its
     * own process (PublicCatalog.ssr.ts calls this directly). The endpoint above is the same data for any
     * caller that wants it as JSON.
     *
     * The translated fields resolve against the AMBIENT culture, which both callers have already scoped —
     * the api route through the culture filter, the SSR route through `CultureInfo.withCultures`.
     */
    export async function categoriesWithProducts(): Promise<CategoryWithProducts[]> {
        const groups = await ProductsLogic.activeProducts.value();

        return groups.map(g => {
            const lite = g.category.toLite();
            return {
                category: lite,
                pictureUrl: g.category.picture == null ? null : `/api/publicCatalog/picture/${String(g.category.id)}`,
                locCategoryName: PropertyRouteTranslationLogic.translatedField(lite, prCategoryName, g.category.categoryName)!,
                locDescription: PropertyRouteTranslationLogic.translatedField(lite, prDescription, g.category.description)!,
                products: g.products,
            };
        });
    }

    // The category pictures are loaded from terminal/northwind/image_categories, whose files are PNG today — so the
    // media type is read off the name rather than assumed.
    function mimeTypeOf(fileName: string): string {
        const ext = fileName.toLowerCase().tryAfterLast(".");
        switch (ext) {
            case "png": return "image/png";
            case "gif": return "image/gif";
            case "webp": return "image/webp";
            case "bmp": return "image/bmp";
            default: return "image/jpeg";
        }
    }
}
