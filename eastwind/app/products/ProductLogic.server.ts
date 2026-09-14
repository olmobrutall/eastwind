import "@altea/altea/server";
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery / withExpressionTo
import "@altea/altea/server/fluentOperations"; // FluentInclude.withSave / withDelete
import "@altea/altea-cache/server/CacheLogic"; // FluentInclude.withCache
import { Query } from "@altea/altea/server/query";
import { withQuoted } from "@altea/altea/data/decorators";
import { table } from "@altea/altea/server/table";
import type { int } from "@altea/altea/data/basics";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import { AutoDynamicQueryCore } from "@altea/altea/server/dynamicQuery/dynamicQueryCore";
import { SchemaBuilder } from "@altea/altea/server/schema";
import type { ResetLazy } from "@altea/altea/server/resetLazy";
import { SupplierEntity, CategoryEntity, ProductEntity, SupplierOperation, CategoryOperation, ProductOperation, CurrentProductsRowModel } from "./Product.data";
import { OrderLineEntity } from "../orders/Order.data";

/** One category and the non-discontinued products in it — a row of {@link ProductsLogic.activeProducts}. */
export interface CategoryProducts {
    category: CategoryEntity;
    products: ProductEntity[];
}

// Query navigation (declared in entities/products.ts, implemented here — where table(T) lives).
ProductEntity.prototype.lines = withQuoted(function (this: ProductEntity): Query<OrderLineEntity> {
    return table(OrderLineEntity).filter(ol => ol.product.id == this.id);
});

// Port of Southwind's ProductsLogic.Start. The ProductEntity_AdditionalInformation part rows are
// pulled in transitively via ProductEntity.additionalInformation.
export namespace ProductsLogic {

    /**
     * Southwind's `ProductsLogic.ActiveProducts` — every non-discontinued product, grouped by its category.
     * What the anonymous public catalog (publicApi/PublicCatalog.server.ts) renders, which is why it is a
     * lazy: that page is reachable with no user and would otherwise re-query on every visit.
     *
     * Signum's is a `FrozenDictionary<CategoryEntity, List<ProductEntity>>`. Here it is an ARRAY of pairs:
     * altea gives each query its own Retriever, so two reads of the same row are two objects and an
     * identity-keyed Map would group nothing (the accommodation @altea/altea-workflow documents).
     */
    export let activeProducts: ResetLazy<CategoryProducts[]>;

    export function start(sb: SchemaBuilder): void {
        sb.include(SupplierEntity)
            .withSave(SupplierOperation.Save)
            .withQuery();
        // Cached (see ShippersLogic for the rationale): eight rows, referenced by every product. altea-cache
        // pulls its dependency closure in too, so nothing else needs marking.
        sb.include(CategoryEntity)
            .withCache()
            .withSave(CategoryOperation.Save)
            .withQuery();
        sb.include(ProductEntity)
            // Cached as well, which is what pulls the whole shape into the cache: its Lite<Supplier> /
            // Lite<Category> references, and its @part additionalInformation rows (served from the CHILD
            // type's own cached table through a back-reference index — altea has no MList table).
            .withCache()
            .withSave(ProductOperation.Save)
            // Southwind exposes ProductEntity's order lines; altea registers ProductEntity.lines() as a
            // queryable expression token (`ProductEntity.lines` → the OrderLines whose product is this one).
            .withExpressionTo(p => p.lines())
            .withQuery();

        // Southwind's `QueryLogic.Queries.Register(ProductQuery.CurrentProducts, …)`. A projection, so
        // it is an AutoDynamicQueryCore over the projected Query rather than a `withQuery()` — which
        // takes no projection — and its NAME is the row model (see CurrentProductsRowModel).
        QueryLogic.queries.register(CurrentProductsRowModel, () => new AutoDynamicQueryCore(() =>
            table(ProductEntity)
                .filter(p => !p.discontinued)
                .map(p => CurrentProductsRowModel.create({
                    entity: p.toLite(),
                    id: p.id as int,
                    productName: p.productName,
                    supplier: p.supplier,
                    category: p.category,
                    quantityPerUnit: p.quantityPerUnit,
                    unitPrice: p.unitPrice,
                    unitsInStock: p.unitsInStock,
                }))));

        activeProducts = sb.globalLazy(async () => {
            const products = await table(ProductEntity).filter(p => !p.discontinued).toArray() as ProductEntity[];
            const byCategory = products.groupToObject(p => p.category.key());
            // Signum projects `p.Category.Entity` inside the query; altea reads the categories separately
            // (they are eight cached rows) and joins on the lite KEY — see the note on activeProducts.
            const categories = await table(CategoryEntity).toArray() as CategoryEntity[];
            return categories
                .map(c => ({ category: c, products: byCategory[c.toLite().key()] ?? [] }))
                .filter(cp => cp.products.length > 0);
        }, { invalidateWith: [ProductEntity, CategoryEntity] });

        // Southwind also keeps `AdditionalInformationKeys` here, feeding its
        // `WithExpressionWithParameter(ProductMessage.AdditionalInfo, …)` product query token. altea has no
        // parameterized expression token, so neither the lazy nor the token is ported.
    }
}
