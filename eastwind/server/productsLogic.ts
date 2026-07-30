import "@altea/altea/server";
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery / withExpressionTo
import { Query } from "@altea/altea/server/query";
import { withQuoted } from "@altea/altea/entities/decorators";
import { table } from "@altea/altea/server/table";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { SupplierEntity, CategoryEntity, ProductEntity } from "../entities/products";
import { OrderLineEntity } from "../entities/orders";

// Query navigation (declared in entities/products.ts, implemented here — where table(T) lives).
ProductEntity.prototype.lines = withQuoted(function (this: ProductEntity): Query<OrderLineEntity> {
    return table(OrderLineEntity).filter(ol => ol.product.id == this.id);
});

// Port of Southwind's ProductsLogic.Start. The ProductEntity_AdditionalInformation part rows are
// pulled in transitively via ProductEntity.additionalInformation.
export namespace ProductsLogic {
    export function start(sb: SchemaBuilder): void {
        sb.include(SupplierEntity).withQuery();
        sb.include(CategoryEntity).withQuery();
        sb.include(ProductEntity)
            // Southwind exposes ProductEntity's order lines; altea registers ProductEntity.lines() as a
            // queryable expression token (`ProductEntity.lines` → the OrderLines whose product is this one).
            .withExpressionTo(p => p.lines())
            .withQuery();
    }
}
