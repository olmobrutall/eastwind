import { reflect, init } from "@altea/altea/data/reflection";
import { Entity } from "@altea/altea/data/entity";
import { Lite } from "@altea/altea/data/lite";
import { entity, quoted, backReference, rowOrder, translatable } from "@altea/altea/data/decorators";
import { type int, Decimal } from "@altea/altea/data/basics";
import { msg } from "@altea/altea/data/utils/localization";
import type { IQuery } from "@altea/altea/data/iquery";
import type { ExecuteSymbol } from "@altea/altea/data/operations";
import { FileEmbedded } from "@altea/altea-files/data/Files";
import { AddressEmbedded } from "../customers/Customer.data";
import type { OrderLineEntity } from "../orders/Order.data";

// Port of Southwind's Products domain (Southwind/Products/*.cs). CategoryEntity's Picture IS ported now that
// @altea/altea-files exists; the ML PredictorPublication is still omitted. AdditionalInformation is an
// [PreserveOrder] MList<AdditionalInformationEmbedded> → the owned part entity
// ProductEntity_AdditionalInformation (embedded fields flattened + @rowOrder).

@entity("Main", "Master")
export class SupplierEntity extends Entity {
    companyName: string;
    contactName: string | null;
    contactTitle: string | null;
    address: AddressEmbedded;
    phone: string;
    fax: string;
    homePage: string | null;
    @quoted toString(): string { return this.companyName; }
}

export namespace SupplierOperation {
    export const Save: ExecuteSymbol<SupplierEntity> = init();
}

@entity("String", "Master")
export class CategoryEntity extends Entity {
    // Southwind marks both of these `[Translatable]` (Products/CategoryEntity.cs) — a category's name and
    // blurb are the app's canonical example of text worth translating PER ROW, which is what
    // @altea/altea-translations' instance half manages.
    @translatable
    categoryName: string;

    @translatable
    description: string;
    // Southwind's `FileEmbedded? Picture` (Products/CategoryEntity.cs) — the bytes live in the row. Loaded
    // from terminal/image_categories rather than Northwind's own Categories.Picture, which the two vendor
    // scripts disagree about (see northwindSeed.ts).
    picture: FileEmbedded | null;
    @quoted toString(): string { return this.categoryName; }
}

export namespace CategoryOperation {
    export const Save: ExecuteSymbol<CategoryEntity> = init();
}

@entity("Main", "Master")
export class ProductEntity extends Entity {
    productName: string;
    supplier: Lite<SupplierEntity>;
    category: Lite<CategoryEntity>;
    quantityPerUnit: string;
    unitPrice: Decimal;
    unitsInStock: int;
    reorderLevel: int;
    discontinued: boolean;
    // Signum's [PreserveOrder] MList<AdditionalInformationEmbedded> → owned part rows.
    additionalInformation: ProductEntity_AdditionalInformation[];

    // Signum's [AutoExpressionField] ValueInStock => UnitPrice * UnitsInStock.
    @quoted valueInStock(): Decimal { return Decimal.mul(this.unitPrice, this.unitsInStock); }

    @quoted toString(): string { return this.productName; }
}
// Cross-entity navigation declared here, implemented in logic/ (where table(T) lives).
export interface ProductEntity {
    lines(): IQuery<OrderLineEntity>;
}

// Owned child rows for ProductEntity.additionalInformation (per-row equivalent of Signum's
// AdditionalInformationEmbedded).
@entity("Part")
export class ProductEntity_AdditionalInformation extends Entity {
    @backReference product: Lite<ProductEntity>;
    @rowOrder rowOrder: int;
    key: string;
    value: string;
}

export namespace ProductOperation {
    export const Save: ExecuteSymbol<ProductEntity> = init();
}

// Southwind's `[AllowUnauthenticated] enum CatalogMessage` (Products/ProductEntity.cs) — the four column
// captions of the ANONYMOUS public catalog page (publicApi/PublicCatalog.tsx). They are MESSAGES rather
// than `ProductEntity.nicePropertyName(...)` reads because that page is reachable with no user, and a
// property's nice name is part of the role-filtered metadata blob. altea needs no `[AllowUnauthenticated]`
// counterpart: a message lives in the translation files, which the reflection endpoint already serves
// anonymously.
export const CatalogMessage = {
    productName: msg(),
    unitPrice: msg(),
    quantityPerUnit: msg(),
    unitsInStock: msg(),
};
