import { noRepeatValidator, stringLengthValidator } from "@altea/altea/data/validators";
import { reflect, init } from "@altea/altea/data/reflection";
import { Entity, ModelEntity } from "@altea/altea/data/entity";
import { Lite } from "@altea/altea/data/lite";
import { entity, part, quoted, backReference, rowOrder, translatable, uniqueIndex, unit, legacyPropertyRoute } from "@altea/altea/data/decorators";
import { type int, type short, Decimal } from "@altea/altea/data/basics";
import { msg } from "@altea/altea/data/utils/localization";
import type { IQuery } from "@altea/altea/data/iquery";
import type { ExecuteSymbol } from "@altea/altea/data/operations";
import { FileEmbedded } from "@altea/altea-files/data/Files";
import { AddressEmbedded } from "../customers/Customer.data";
import type { OrderLineEntity } from "../orders/Order.data";
import type { PredictorPublicationSymbol } from "@altea/altea-machine-learning/data/Predictor";

// The Products domain. A product's additional information is an ordered list of owned part rows
// ProductEntity_AdditionalInformation (embedded fields flattened + @rowOrder).

@entity("Main", "Master")
export class SupplierEntity extends Entity {
    @uniqueIndex
    @stringLengthValidator({ min: 3, max: 40 })
    companyName: string;
    @stringLengthValidator({ min: 3, max: 30 })
    contactName: string | null;
    @stringLengthValidator({ min: 3, max: 30 })
    contactTitle: string | null;
    address: AddressEmbedded;
    @stringLengthValidator({ min: 3, max: 24 })
    phone: string;
    @stringLengthValidator({ min: 3, max: 24 })
    fax: string;
    @stringLengthValidator({ min: 3, multiLine: true })
    homePage: string | null;
    @quoted toString(): string { return this.companyName; }
}

export namespace SupplierOperation {
    export const Save: ExecuteSymbol<SupplierEntity> = init();
}

@entity("String", "Master")
export class CategoryEntity extends Entity {
    // A category's name and blurb are the app's canonical example of text worth translating PER ROW,
    // which is what @altea/altea-translations' instance half manages.
    @uniqueIndex
    @translatable
    @stringLengthValidator({ min: 3, max: 100 })
    categoryName: string;

    @translatable
    @stringLengthValidator({ min: 3, multiLine: true })
    description: string;
    // The bytes live in the row. Loaded from terminal/northwind/image_categories rather than Northwind's
    // own Categories.Picture, which the two vendor scripts disagree about (see northwindSeed.ts).
    picture: FileEmbedded | null;
    @quoted toString(): string { return this.categoryName; }
}

export namespace CategoryOperation {
    export const Save: ExecuteSymbol<CategoryEntity> = init();
}

@entity("Main", "Master")
export class ProductEntity extends Entity {
    @uniqueIndex
    @stringLengthValidator({ min: 3, max: 40 })
    productName: string;
    supplier: Lite<SupplierEntity>;
    category: Lite<CategoryEntity>;
    @stringLengthValidator({ min: 3, max: 20 })
    quantityPerUnit: string;
    unitPrice: Decimal;
    /** A stock count fits a smallint, and the column is one. */
    unitsInStock: short;
    reorderLevel: int;
    discontinued: boolean;
    // Owned part rows, order preserved.
    @noRepeatValidator<ProductEntity_AdditionalInformation>(a => a.key)
    additionalInformation: ProductEntity_AdditionalInformation[];

    // ValueInStock = unitPrice * unitsInStock. A legacy database holds this as a PROPERTY route with a
    // property rule on it, so @legacyPropertyRoute keeps a legacy sync from removing both.
    @legacyPropertyRoute
    @quoted valueInStock(): Decimal { return Decimal.mul(this.unitPrice, this.unitsInStock); }

    @quoted toString(): string { return this.productName; }
}
// Cross-entity navigation declared here, implemented in logic/ (where table(T) lives).
export interface ProductEntity {
    lines(): IQuery<OrderLineEntity>;
}

// Owned child rows for ProductEntity.additionalInformation. The row IS a class, so its unique index goes
// where the columns are rather than in the logic layer.
@part
@uniqueIndex((r: ProductEntity_AdditionalInformation) => [r.product, r.key])
export class ProductEntity_AdditionalInformation extends Entity {
    @backReference product: Lite<ProductEntity>;
    @rowOrder rowOrder: int;
    key: string;
    value: string;
}

export namespace ProductOperation {
    export const Save: ExecuteSymbol<ProductEntity> = init();
}

/**
 * The name under which the app's trained sales model is PUBLISHED: "of all the predictors ever trained,
 * this
 * one is live for monthly sales". SalesEstimation reads through it rather than naming a predictor row,
 * so re-training and publishing swaps the model with no code change. Registered in starter.server.ts.
 */
export namespace ProductPredictorPublication {
    export const MonthlySales: PredictorPublicationSymbol = init();
}

// The four column captions of the ANONYMOUS public catalog page (publicApi/PublicCatalog.tsx). They are
// MESSAGES rather
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

// The products still on sale. A query is named by its ROW MODEL, whose clean name IS the query key
// (`CurrentProductsRowModel` → `CurrentProducts`, see data/registration's cleanTypeName), and the model's
// members are the columns.
@reflect
export class CurrentProductsRowModel extends ModelEntity {
    /** The row identity: what the SearchControl navigates to and selects. */
    entity: Lite<ProductEntity>;
    id: int;
    productName: string;
    supplier: Lite<SupplierEntity>;
    category: Lite<CategoryEntity>;
    quantityPerUnit: string;
    @unit("€") unitPrice: Decimal;
    unitsInStock: short;
}
