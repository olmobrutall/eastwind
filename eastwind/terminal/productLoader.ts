import "@altea/altea/server";
import { Connector } from "@altea/altea/server/connection/connector";
import { view } from "@altea/altea/server/table";
import { BulkInserter } from "@altea/altea/server/bulkInserter";
import { toInt, Decimal } from "@altea/altea/data/basics";
import { SupplierEntity, CategoryEntity, ProductEntity, ProductEntity_AdditionalInformation } from "../products/Product.data";
import { AddressEmbedded } from "../customers/Customer.data";
import { Northwind, NwSupplier, NwCategory, NwProduct } from "./northwindSchema";

// Port of Southwind.Terminal/ProductLoader.cs (SupplierFaxes.csv, Category.Picture and the EAN/diet
// AdditionalInformation rules are simplified/extension-free). Ids are preserved so Product's Supplier
// and Category lites resolve inline via Type.newLite(id).
export namespace ProductLoader {
    export async function loadSuppliers(): Promise<void> {
        const suppliers = await Connector.withConnector(Northwind.connector(), () => view(NwSupplier).toArray());
        await BulkInserter.bulkInsert(suppliers.map(s => {
            const e = SupplierEntity.create({
                companyName: s.CompanyName,
                contactName: s.ContactName,
                contactTitle: s.ContactTitle,
                address: AddressEmbedded.create({
                    address: s.Address ?? "", city: s.City ?? "", region: s.Region,
                    postalCode: s.PostalCode, country: s.Country ?? "",
                }),
                phone: s.Phone ?? "",
                fax: s.Fax ?? "",
                homePage: s.HomePage,
            });
            e.id = s.SupplierID;
            return e;
        }));
    }

    export async function loadCategories(): Promise<void> {
        const categories = await Connector.withConnector(Northwind.connector(), () => view(NwCategory).toArray());
        await BulkInserter.bulkInsert(categories.map(c => {
            const e = CategoryEntity.create({
                categoryName: c.CategoryName,
                description: c.Description ?? "",
            });
            e.id = c.CategoryID;
            return e;
        }));
    }

    export async function loadProducts(): Promise<void> {
        const products = await Connector.withConnector(Northwind.connector(), () => view(NwProduct).toArray());

        // Signum's `.BulkInsert(disableIdentity:true)`: preserved ids + the AdditionalInformation MList
        // cascade. The product back-reference + @rowOrder are wired by the cascade.
        await BulkInserter.bulkInsert(products.map(s => {
            const info: ProductEntity_AdditionalInformation[] = [];
            const add = (key: string, value: string): void => {
                info.push(ProductEntity_AdditionalInformation.create({ key, value }));
            };
            add("EAN", "EAN000" + String(s.ProductID).padStart(4, "0"));
            if (s.ProductID % 10 === 0) add("Lactosa", "True");
            if (s.ProductID % 7 === 0) add("Gluten", "True");
            const mod = s.ProductID % 13;
            add("VegMode", mod < 10 ? "No" : mod === 10 ? "Vegetarian" : mod === 11 ? "Vegan" : "Macrobiotic");

            const p = ProductEntity.create({
                productName: s.ProductName,
                supplier: SupplierEntity.newLite(s.SupplierID!),
                category: CategoryEntity.newLite(s.CategoryID!),
                quantityPerUnit: s.QuantityPerUnit ?? "",
                unitPrice: s.UnitPrice ?? new Decimal(0),
                unitsInStock: s.UnitsInStock ?? toInt(0),
                reorderLevel: s.ReorderLevel ?? toInt(0),
                discontinued: s.Discontinued,
                additionalInformation: info,
            });
            p.id = s.ProductID;
            return p;
        }));
    }
}
