import "@altea/altea/server";
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery / withExpressionTo
import "@altea/altea/server/operationFluentInclude"; // FluentInclude.withSave / withDelete
import "@altea/altea-cache/server/CacheLogic"; // FluentInclude.withCache
import { Query } from "@altea/altea/server/query";
import { withQuoted } from "@altea/altea/data/decorators";
import { table } from "@altea/altea/server/table";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { SupplierEntity, CategoryEntity, ProductEntity, SupplierOperation, CategoryOperation, ProductOperation } from "./Product.data";
import { OrderLineEntity } from "../orders/Order.data";

// Query navigation (declared in entities/products.ts, implemented here — where table(T) lives).
ProductEntity.prototype.lines = withQuoted(function (this: ProductEntity): Query<OrderLineEntity> {
    return table(OrderLineEntity).filter(ol => ol.product.id == this.id);
});

// Port of Southwind's ProductsLogic.Start. The ProductEntity_AdditionalInformation part rows are
// pulled in transitively via ProductEntity.additionalInformation.
export namespace ProductsLogic {
    export function start(sb: SchemaBuilder): void {
        sb.include(SupplierEntity).withSave(SupplierOperation.Save).withQuery();
        // Cached (see ShippersLogic for the rationale): eight rows, referenced by every product. altea-cache
        // pulls its dependency closure in too, so nothing else needs marking.
        sb.include(CategoryEntity).withSave(CategoryOperation.Save).withCache().withQuery();
        sb.include(ProductEntity)
            .withSave(ProductOperation.Save)
            // Cached as well, which is what pulls the whole shape into the cache: its Lite<Supplier> /
            // Lite<Category> references, and its @part additionalInformation rows (served from the CHILD
            // type's own cached table through a back-reference index — altea has no MList table).
            .withCache()
            // Southwind exposes ProductEntity's order lines; altea registers ProductEntity.lines() as a
            // queryable expression token (`ProductEntity.lines` → the OrderLines whose product is this one).
            .withExpressionTo(p => p.lines())
            .withQuery();
    }
}
