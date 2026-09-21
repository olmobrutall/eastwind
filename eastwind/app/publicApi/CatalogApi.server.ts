import "@altea/altea/server";
import { table } from "@altea/altea/server/table";
import { WebBuilder, CustomType } from "@altea/altea/server/webApi";
import { RestLogFilter } from "@altea/altea-rest/server/RestLogFilter";
import { CategoryEntity } from "../products/Product.data";

// The app's PUBLIC REST surface: the one place a
// machine caller (rather than the SPA) reaches, authenticated by an API key and logged by @altea/altea-rest.
//
// It exists because that is the only way to demonstrate the module end to end: an API-key authenticator and
// a request log have nothing to authenticate or log until an app declares a public endpoint.
//
// The folder is `publicApi/` rather than `public/`: `eastwind/public/` is already vite's static
// asset directory.
export namespace CatalogApi {

    /** A hand-shaped payload, deliberately NOT the entity. */
    export interface CategoryDto {
        id: number;
        name: string;
        description: string;
    }

    export function start(ws: WebBuilder): void {

        // The replayable REST log. Mounted on the PREFIX the
        // endpoints below share — the counterpart of decorating a controller class (see the module's
        // RestLogFilter header) — and AFTER AuthLogic.start, so the per-request user scope already exists.
        ws.app.use("/api/catalog", RestLogFilter.middleware({ name: "CatalogApi", allowReplay: true }));

        // `allowAnonymous` is NOT set.
        // Note what that does and does not buy once an ANONYMOUS USER is configured (it is, see
        // AuthLogic.start in starter.server.ts): the route-level gate no longer rejects a caller with no
        // token — the authenticator chain resolves the anonymous user BEFORE it consults the
        // allow-anonymous flag — so this endpoint is reachable without an API
        // key and answers whatever the Anonymous ROLE may read. Category is on that list, so it answers.
        // The API key is what gets a caller MORE than the anonymous role, and what the RestLog above
        // attributes the request to. An app that wants the endpoint
        // shut to anonymous callers gives the Anonymous role no Category rule.
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
