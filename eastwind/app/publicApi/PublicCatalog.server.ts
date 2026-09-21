import "@altea/altea/server";
import { WebBuilder, CustomType } from "@altea/altea/server/webApi";
import { PropertyRoute } from "@altea/altea/data/propertyRoute";
import { PropertyRouteTranslationLogic } from "@altea/altea/server/propertyRouteTranslation";
import { CategoryEntity } from "../products/Product.data";
import { ProductsLogic } from "../products/ProductLogic.server";
import type { CategoryWithProducts } from "./PublicCatalog.data";

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
            async (_req, res) => {
                const groups = await ProductsLogic.activeProducts.value();

                res.jsonTyped(groups.map(g => {
                    const lite = g.category.toLite();
                    const picture = g.category.picture;
                    return {
                        category: lite,
                        picture: picture == null ? null : Buffer.from(picture.binaryFile).toString("base64"),
                        pictureMimeType: picture == null ? null : mimeTypeOf(picture.fileName),
                        locCategoryName: PropertyRouteTranslationLogic.translatedField(lite, prCategoryName, g.category.categoryName)!,
                        locDescription: PropertyRouteTranslationLogic.translatedField(lite, prDescription, g.category.description)!,
                        products: g.products,
                    };
                }));
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
