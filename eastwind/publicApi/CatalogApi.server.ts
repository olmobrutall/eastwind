import "@altea/altea/server";
import { table } from "@altea/altea/server/table";
import { WebBuilder, CustomType } from "@altea/altea/server/webApi";
import { RestLogFilter } from "@altea/altea-rest/server/RestLogFilter.server";
import { CategoryEntity } from "../products/Product.data";

// Port of Southwind's `Public/CatalogAPIController.cs` — the app's PUBLIC REST surface: the one place a
// machine caller (rather than the SPA) reaches, authenticated by an API key and logged by @altea/altea-rest.
//
// It exists because that is the only way to demonstrate the module end to end: an API-key authenticator and
// a request log have nothing to authenticate or log until an app declares a public endpoint.
//
// The folder is `publicApi/` rather than Southwind's `Public/`: `eastwind/public/` is already vite's static
// asset directory.
export namespace CatalogApi {

    /** Southwind's `CategoryDTO` — a hand-shaped payload, deliberately NOT the entity. */
    export interface CategoryDto {
        id: number;
        name: string;
        description: string;
    }

    export function start(ws: WebBuilder): void {

        // Signum's `[RestLogFilter(allowReplay: true)]` on the controller. Mounted on the PREFIX the
        // endpoints below share — the counterpart of decorating a controller class (see the module's
        // RestLogFilter header) — and AFTER AuthLogic.start, so the per-request user scope already exists.
        ws.app.use("/api/catalog", RestLogFilter.middleware({ name: "CatalogApi", allowReplay: true }));

        // `allowAnonymous` is NOT set: the secure-by-default gate applies, so a caller must present a
        // valid API key (or a session token). That is exactly what Southwind's swagger flow does.
        ws.get("/api/catalog/categories",
            { res: CustomType<CategoryDto[]>() },
            async (_req, res) => {
                const categories = await table(CategoryEntity)
                    .map(c => ({ id: c.id, name: c.categoryName, description: c.description }))
                    .toArray();

                res.jsonTyped(categories.map(c => ({
                    id: Number(c.id),
                    name: c.name,
                    description: c.description,
                })));
            });
    }
}
