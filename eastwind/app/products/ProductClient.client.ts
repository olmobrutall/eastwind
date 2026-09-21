import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { Finder } from "@altea/altea/client/Finder";
import { ProductEntity, CategoryEntity, SupplierEntity } from "./Product.data";

// Products domain client (also registers Supplier/Category types via the module import).
export namespace ProductsClient {
    export function start(cb: ClientBuilder): void {
        cb.configure(ProductEntity)
            .withView(() => import("./Product"))
            .withQuerySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.productName),
                    token(a => a.supplier),
                    token(a => a.category),
                    token(a => a.unitPrice),
                ],
                // The default filters: the pinned "Search" Or-group searching the
                // product name and the (dereferenced) supplier/category names in one box. Finder.
                // filterGroupSearch supplies the pinned label + `splitValue` (words applied across the
                // group) + `active: "WhenHasValue"`.
                defaultFilters: [Finder.filterGroupSearch([
                    { token: token(a => a.productName), operation: "Contains" },
                    { token: token(a => a.supplier.entity.companyName), operation: "Contains" },
                    { token: token(a => a.category.entity.categoryName), operation: "Contains" },
                ])],
            }));

        cb.configure(CategoryEntity)
            .withView(() => import("./Category"));

        cb.configure(SupplierEntity)
            .withView(() => import("./Supplier"));
    }
}
