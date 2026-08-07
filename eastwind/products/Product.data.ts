import { reflect, init } from "@altea/altea/data/reflection";
import { Entity } from "@altea/altea/data/entity";
import { Lite } from "@altea/altea/data/lite";
import { entity, quoted, backReference, rowOrder } from "@altea/altea/data/decorators";
import { type int, type decimal } from "@altea/altea/data/basics";
import type { IQuery } from "@altea/altea/data/iquery";
import type { ExecuteSymbol } from "@altea/altea/data/operations";
import { AddressEmbedded } from "../customers/Customer.data";
import type { OrderLineEntity } from "../orders/Order.data";

// Port of Southwind's Products domain (Southwind/Products/*.cs). Extension-free: CategoryEntity's
// Picture (Signum.Files) and the ML PredictorPublication are omitted. AdditionalInformation is an
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
    categoryName: string;
    description: string;
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
    unitPrice: decimal;
    unitsInStock: int;
    reorderLevel: int;
    discontinued: boolean;
    // Signum's [PreserveOrder] MList<AdditionalInformationEmbedded> → owned part rows.
    additionalInformation: ProductEntity_AdditionalInformation[];

    // Signum's [AutoExpressionField] ValueInStock => UnitPrice * UnitsInStock.
    @quoted valueInStock(): number { return this.unitPrice * this.unitsInStock; }

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
