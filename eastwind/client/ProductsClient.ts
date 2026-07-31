import { Finder } from "@altea/altea/client/Finder";
import { ProductEntity } from "eastwind/entities/products";

// Products domain client (also registers Supplier/Category types via the module import).
export namespace ProductsClient {
    export function start(): void {
        Finder.addSettings(
            ProductEntity.querySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.productName),
                    token(a => a.supplier),
                    token(a => a.category),
                    token(a => a.unitPrice),
                ],
            })),
        );
    }
}
