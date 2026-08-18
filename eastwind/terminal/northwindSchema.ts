import { reflect } from "@altea/altea/data/reflection";
import { tableName, viewPrimaryKey } from "@altea/altea/data/decorators";
import { View } from "@altea/altea/data/entity";
import { Temporal, type int, Decimal } from "@altea/altea/data/basics";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { Connector } from "@altea/altea/server/connection/connector";
import { SqlServerConnector } from "@altea/altea/server/connection/sqlServerConnector";

// Port of Southwind.Terminal/NorthwindSchema.cs: one IView per Northwind table. altea's view classes
// `extends View` (Signum's `: IView`) and are `@reflect` + `@tableName("dbo.X")` + `@viewPrimaryKey`
// fields, with column name = FIELD NAME VERBATIM (viewBuilder.ts) — so these properties are PascalCase
// to match the real Northwind columns. Binary columns (Photo, Picture) are skipped (extension-free, no
// Signum.Files).

@reflect @tableName("dbo.Region")
export class NwRegion extends View {
    @viewPrimaryKey RegionID!: int;
    RegionDescription!: string;
}

@reflect @tableName("dbo.Territories")
export class NwTerritory extends View {
    @viewPrimaryKey TerritoryID!: string;
    TerritoryDescription!: string;
    RegionID!: int;
}

@reflect @tableName("dbo.EmployeeTerritories")
export class NwEmployeeTerritory extends View {
    @viewPrimaryKey EmployeeID!: int;
    @viewPrimaryKey TerritoryID!: string;
}

@reflect @tableName("dbo.Employees")
export class NwEmployee extends View {
    @viewPrimaryKey EmployeeID!: int;
    LastName!: string;
    FirstName!: string;
    Title!: string | null;
    TitleOfCourtesy!: string | null;
    BirthDate!: Temporal.PlainDateTime | null;
    HireDate!: Temporal.PlainDateTime | null;
    Address!: string | null;
    City!: string | null;
    Region!: string | null;
    PostalCode!: string | null;
    Country!: string | null;
    HomePhone!: string | null;
    Extension!: string | null;
    Notes!: string | null;
    ReportsTo!: int | null;
    PhotoPath!: string | null;
}

@reflect @tableName("dbo.Suppliers")
export class NwSupplier extends View {
    @viewPrimaryKey SupplierID!: int;
    CompanyName!: string;
    ContactName!: string | null;
    ContactTitle!: string | null;
    Address!: string | null;
    City!: string | null;
    Region!: string | null;
    PostalCode!: string | null;
    Country!: string | null;
    Phone!: string | null;
    Fax!: string | null;
    HomePage!: string | null;
}

@reflect @tableName("dbo.Categories")
export class NwCategory extends View {
    @viewPrimaryKey CategoryID!: int;
    CategoryName!: string;
    Description!: string | null;
    // Northwind stores the picture as an OLE-wrapped bitmap (Southwind strips the 78-byte header).
    Picture!: Uint8Array | null;
}

@reflect @tableName("dbo.Products")
export class NwProduct extends View {
    @viewPrimaryKey ProductID!: int;
    ProductName!: string;
    SupplierID!: int | null;
    CategoryID!: int | null;
    QuantityPerUnit!: string | null;
    UnitPrice!: Decimal | null;
    UnitsInStock!: int | null;
    ReorderLevel!: int | null;
    Discontinued!: boolean;
}

@reflect @tableName("dbo.Customers")
export class NwCustomer extends View {
    @viewPrimaryKey CustomerID!: string;
    CompanyName!: string;
    ContactName!: string | null;
    ContactTitle!: string | null;
    Address!: string | null;
    City!: string | null;
    Region!: string | null;
    PostalCode!: string | null;
    Country!: string | null;
    Phone!: string | null;
    Fax!: string | null;
}

@reflect @tableName("dbo.Shippers")
export class NwShipper extends View {
    @viewPrimaryKey ShipperID!: int;
    CompanyName!: string;
    Phone!: string | null;
}

@reflect @tableName("dbo.Orders")
export class NwOrder extends View {
    @viewPrimaryKey OrderID!: int;
    CustomerID!: string | null;
    EmployeeID!: int | null;
    OrderDate!: Temporal.PlainDateTime | null;
    RequiredDate!: Temporal.PlainDateTime | null;
    ShippedDate!: Temporal.PlainDateTime | null;
    ShipVia!: int | null;
    Freight!: Decimal | null;
    ShipName!: string | null;
    ShipAddress!: string | null;
    ShipCity!: string | null;
    ShipRegion!: string | null;
    ShipPostalCode!: string | null;
    ShipCountry!: string | null;
}

// "Order Details" has a space in the real name; @tableName keeps it verbatim (the SQL builder brackets
// it). Composite PK (OrderID + ProductID) so the flat read doesn't collapse rows by a non-unique key.
@reflect @tableName("dbo.Order Details")
export class NwOrderDetail extends View {
    @viewPrimaryKey OrderID!: int;
    @viewPrimaryKey ProductID!: int;
    UnitPrice!: Decimal;
    Quantity!: int;
    Discount!: Decimal;
}

// A separate SqlServerConnector for the Northwind database (always SQL Server; NORTHWIND_DB). Reads
// run under Connector.withConnector(Northwind.connector(), () => view(NwX).toArray()) — Signum's
// `Connector.Override(Northwind.Connector).Using(...)`.
export namespace Northwind {
    let _connector: Connector | undefined;
    export function connector(): Connector {
        if (_connector == null) {
            const connStr = process.env["NORTHWIND_DB"];
            if (connStr == null || connStr === "")
                throw new Error("Set NORTHWIND_DB to the Northwind SQL Server connection string.");
            const sb = new SchemaBuilder();
            sb.settings.isPostgres = false; // Northwind is always SQL Server
            _connector = new SqlServerConnector(sb.schema, connStr);
        }
        return _connector;
    }
    export async function close(): Promise<void> {
        if (_connector != null) { await _connector.closeConnection(); _connector = undefined; }
    }
}
