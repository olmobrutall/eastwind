import { reflect } from "@altea/altea/data/reflection";
import { tableName, viewPrimaryKey } from "@altea/altea/data/decorators";
import { View } from "@altea/altea/data/entity";
import { Temporal, type int, type short, Decimal } from "@altea/altea/data/basics";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { ViewBuilder } from "@altea/altea/server/schema/viewBuilder";
import { ObjectName, SchemaName, DatabaseName } from "@altea/altea/server/schema/objectName";
import type { FieldInfo, TypeInfo } from "@altea/altea/data/reflection";
import { Connector } from "@altea/altea/server/connection/connector";

// Port of Southwind.Terminal/NorthwindSchema.cs: one IView per Northwind table. altea's view classes
// `extends View` (Signum's `: IView`) and are `@reflect` + `@tableName("dbo.X")` + `@viewPrimaryKey`
// fields, with column name = FIELD NAME VERBATIM (viewBuilder.ts) — so these properties are PascalCase
// to match the real Northwind columns.
//
// ONE set of views serves BOTH dialects, declared in Northwind's own SQL Server spelling. The Postgres
// source is a pg_dump that spells everything snake_case under `public`, and `NorthwindPostgresViewBuilder`
// (below) maps between the two — so both vendor scripts run VERBATIM and nothing here is duplicated.
//
// The BINARY columns (Categories.Picture, Employees.Photo) are deliberately absent: they are the one place
// the two scripts disagree on DATA, so the images come off disk instead (northwindImages.ts).

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
    // `Picture` is NOT mapped — see the header. Southwind reads Northwind's OLE-wrapped bitmap out of this
    // column and strips its 78-byte header; here the loader reads image_categories/<CategoryName>.<ext>.
}

@reflect @tableName("dbo.Products")
export class NwProduct extends View {
    @viewPrimaryKey ProductID!: int;
    ProductName!: string;
    SupplierID!: int | null;
    CategoryID!: int | null;
    QuantityPerUnit!: string | null;
    UnitPrice!: Decimal | null;
    UnitsInStock!: short | null;
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

/**
 * Reads the `Nw*` views — declared above in Northwind's SQL Server spelling — off the POSTGRES port, whose
 * pg_dump spells the same things `public.order_details.unit_price` where SQL Server spells them
 * `dbo."Order Details"."UnitPrice"`.
 *
 * Installed on the Northwind schema's `viewBuilder` (see `connector()` below) and nowhere else, so this is
 * the ONE place the two conventions are reconciled: both vendor scripts run VERBATIM, and there is no
 * second set of view classes.
 *
 * The mapping is one mechanical rule — PascalCase (and the space in "Order Details") becomes snake_case,
 * the schema becomes `public` — plus exactly one irregular column, because the dump spells HomePage as one
 * word.
 */
export class NorthwindPostgresViewBuilder extends ViewBuilder {

    // `dbo.Categories` → `public.categories`, `dbo.Order Details` → `public.order_details`.
    protected override tableName(typeInfo: TypeInfo): ObjectName {
        const declared = typeInfo.tableName!;
        const name = declared.slice(declared.lastIndexOf(".") + 1);
        return new ObjectName(snakeCase(name), new SchemaName("public", new DatabaseName("")));
    }

    // `CategoryID` → `category_id`, `TitleOfCourtesy` → `title_of_courtesy`.
    protected override columnName(fi: FieldInfo): string {
        return NorthwindPostgresViewBuilder.irregular[fi.name] ?? snakeCase(fi.name);
    }

    // The one name the rule gets wrong: `HomePage` would be `home_page`, and the dump has `homepage`.
    private static readonly irregular: Record<string, string> = {
        HomePage: "homepage",
    };
}

// PascalCase → snake_case. Two breaks: before a capital that follows a lower-case letter or digit
// (`PhotoPath` → `photo_path`), and before the last capital of a RUN that is followed by a lower-case one
// (`IDValue` → `id_value`) — which together leave a trailing acronym intact, so `CategoryID` is
// `category_id` and not `category_i_d`. A space is a word break too, which is what turns Northwind's
// `Order Details` into the dump's `order_details`.
function snakeCase(name: string): string {
    return name
        .replace(/ +/g, "_")
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
        .toLowerCase();
}

// A separate connector for the Northwind SOURCE database (NORTHWIND_DB). Reads run under
// Connector.withConnector(await Northwind.connector(), () => view(NwX).toArray()) — Signum's
// `Connector.Override(Northwind.Connector).Using(...)`.
//
// The DIALECT follows NORTHWIND_DB's own connection string, exactly as EASTWIND_DB's does: "postgres…" is
// PostgreSQL, anything else is SQL Server. So a Postgres app reads its demo data out of Postgres and a SQL
// Server app out of SQL Server, each seeded from its own vendor script (northwindSeed.ts). This used to be
// pinned to SQL Server, which forced a static `SqlServerConnector` import here and pulled the `mssql`
// driver into every host that touched this module; the per-dialect connector is loaded LAZILY for the same
// reason `Starter.start` loads its own that way — hence the async `connector()`.
export namespace Northwind {
    let _connector: Connector | undefined;

    export async function connector(): Promise<Connector> {
        if (_connector == null) {
            const connStr = process.env["NORTHWIND_DB"];
            if (connStr == null || connStr === "")
                throw new Error(
                    "Set NORTHWIND_DB to the Northwind source connection string. Start it with 'postgres' for " +
                    "PostgreSQL; otherwise it is treated as a SQL Server connection string. Run " +
                    "'terminal seed-northwind' to create the data.",
                );
            const sb = new SchemaBuilder();
            sb.settings.isPostgres = connStr.startsWith("postgres");
            if (sb.settings.isPostgres) {
                // Only THIS schema reads snake_case — the app's own is untouched.
                sb.schema.viewBuilder = new NorthwindPostgresViewBuilder(sb.schema);
                _connector = new (await import("@altea/altea/server/connection/postgresConnector")).PostgresConnector(sb.schema, connStr);
            } else {
                _connector = new (await import("@altea/altea/server/connection/sqlServerConnector")).SqlServerConnector(sb.schema, connStr);
            }
        }
        return _connector;
    }

    export async function close(): Promise<void> {
        if (_connector != null) { await _connector.closeConnection(); _connector = undefined; }
    }
}
