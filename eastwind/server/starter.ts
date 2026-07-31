import "@altea/altea/server/context.node"; // register server context storage first
import { Connector } from "@altea/altea/server/connection/connector";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { loadRegisteredTranslations } from "@altea/altea/server/translations";
import { EmployeesLogic } from "./employeesLogic";
import { ProductsLogic } from "./productsLogic";
import { ShippersLogic } from "./shippersLogic";
import { CustomersLogic } from "./customersLogic";
import { OrdersLogic } from "./ordersLogic";

// Port of Southwind's Starter.Start (Southwind/Starter.cs): the single global entry that builds the
// schema, binds the connector, registers each module's logic and completes. Extensions are excluded
// (eastwind → altea only). The dialect is chosen inline from the connection string, mirroring Signum's
// `isPostgres` branch: "postgres…" → PostgreSQL, otherwise SQL Server.
export namespace Starter {
    export async function start(connectionString: string): Promise<{ sb: SchemaBuilder; connector: Connector }> {
        var sb = new SchemaBuilder();

        var connector = connectionString.startsWith("postgres")
            ? new (await import("@altea/altea/server/connection/postgresConnector")).PostgresConnector(sb.schema, connectionString)
            : new (await import("@altea/altea/server/connection/sqlServerConnector")).SqlServerConnector(sb.schema, connectionString);

        Connector.default = connector;
        sb.settings.isPostgres = connector.isPostgres;

        EmployeesLogic.start(sb);
        ProductsLogic.start(sb);
        ShippersLogic.start(sb);
        CustomersLogic.start(sb);
        OrdersLogic.start(sb);

        sb.complete();

        // Merge every registered module's committed translations/ folder (framework → app order).
        loadRegisteredTranslations();

        return { sb, connector };
    }
}
