import "@altea/altea/server/context.node"; // register server context storage first
import { Connector } from "@altea/altea/server/connection/connector";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { SignumServer } from "@altea/altea/server/signumServer";
import type { WebBuilder } from "@altea/altea/server/webApi";
import { ExceptionLogic } from "@altea/altea/server/exceptionLogic";
import { OperationLogic } from "@altea/altea/server/operationLogic";
import { loadAppTranslations } from "@altea/altea/server/translations";
import { EntityOverrides } from "./entityOverrides.data";
import { EmployeesLogic } from "./employees/Employee.server";
import { ProductsLogic } from "./products/Product.server";
import { ShippersLogic } from "./shippers/Shipper.server";
import { CustomersLogic } from "./customers/Customer.server";
import { OrdersLogic } from "./orders/Order.server";
import { AuthLogic } from "@altea/altea-auth/server/AuthLogic";
import { TypeAuthLogic } from "@altea/altea-auth/server/TypeAuthLogic";
import { PermissionAuthLogic } from "@altea/altea-auth/server/PermissionAuthLogic";
import { OperationAuthLogic } from "@altea/altea-auth/server/OperationAuthLogic";
import { QueryAuthLogic } from "@altea/altea-auth/server/QueryAuthLogic";
import { PropertyAuthLogic } from "@altea/altea-auth/server/PropertyAuthLogic";

// Port of Southwind's Starter.Start (Southwind/Starter.cs): the single global entry that builds the
// schema, binds the connector, registers each module's logic and completes. Extensions are excluded
// (eastwind → altea only). The dialect is chosen inline from the connection string, mirroring Signum's
// `isPostgres` branch: "postgres…" → PostgreSQL, otherwise SQL Server.
export namespace Starter {
    // `webBuilder` mirrors Signum's `sb.WebServerBuilder`: the web host passes the WebBuilder it created,
    // Starter sets it on the SchemaBuilder, and each module's `XxxLogic.start(sb)` mounts its own HTTP
    // surface via `if (sb.webBuilder) XxxServer.start(sb.webBuilder)`. A terminal / test omits it (no HTTP).
    export async function start(connectionString: string, webBuilder?: WebBuilder): Promise<{ sb: SchemaBuilder; connector: Connector }> {
        // Shared entity-model declarations (mixins / lite models / implementedBy overrides), applied
        // identically on client and server. Runs before schema build so overrides take effect.
        EntityOverrides.start();

        var sb = new SchemaBuilder();
        sb.webBuilder = webBuilder;

        var connector = connectionString.startsWith("postgres")
            ? new (await import("@altea/altea/server/connection/postgresConnector")).PostgresConnector(sb.schema, connectionString)
            : new (await import("@altea/altea/server/connection/sqlServerConnector")).SqlServerConnector(sb.schema, connectionString);

        Connector.default = connector;
        sb.settings.isPostgres = connector.isPostgres;

        // Framework logic (Signum's part of Starter.Start): the exception log table.
        ExceptionLogic.start(sb);

        EmployeesLogic.start(sb);
        ProductsLogic.start(sb);
        ShippersLogic.start(sb);
        CustomersLogic.start(sb);
        OrdersLogic.start(sb);

        // Authentication module (altea-auth): registers RoleEntity + UserEntity, their operations, and
        // the UserGraph state machine. Before OperationLogic.start so its operation symbols get seeded.
        AuthLogic.start(sb);
        // Authorization engine (coarse slice): Type + Permission rules. Registers Rule* tables + the
        // PermissionSymbol table.
        TypeAuthLogic.start(sb);
        PermissionAuthLogic.start(sb);
        OperationAuthLogic.start(sb);
        QueryAuthLogic.start(sb);
        PropertyAuthLogic.start(sb);

        // Framework operation infrastructure (Signum's OperationLogic.Start): the OperationSymbol table
        // (seeded with the operations the modules above registered) + the OperationLogEntity table/query
        // that backs the operation-log quick link. Must run AFTER the module graphs register.
        OperationLogic.start(sb);

        sb.complete();

        // Signum's Schema.Initialize(): read the persisted TypeEntity ids back into the type↔id caches
        // (internally TypeLogic.load). Tolerant of a not-yet-generated database (the `new`/`create`
        // terminal command runs against an empty DB); the deterministic bootstrap then covers reads until
        // generation seeds the table. `create`/`sync` re-initialize afterwards (see terminal.ts).
        await sb.schema.initialize();

        // Load translations from the app's single translations directory (TRANSLATIONS_ROOT/env or
        // <cwd>/translations). Every module's `<Module>.<culture>.xml` lives there (Signum's model).
        loadAppTranslations();

        // Mount the framework HTTP API last (Signum's SignumServer.Start): after the modules' own routes
        // (registered by their Logic.start above) so the auth middleware/gate run first, and so the JSON
        // exception filter — Express error middleware, registered inside SignumServer.start — is truly last.
        if (sb.webBuilder)
            SignumServer.start(sb.webBuilder);

        return { sb, connector };
    }
}
