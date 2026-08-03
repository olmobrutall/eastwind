import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
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
            }));

        cb.configure(CategoryEntity)
            .withView(() => import("./Category"));

        cb.configure(SupplierEntity)
            .withView(() => import("./Supplier"));
    }
}
