// DATA migration for an existing ALTEA database: SmtpNetworkDeliveryEmbedded stops being a `@part` ENTITY
// (its own `mailing.smtp_network_delivery_embedded` table, reached by `smtp_email_service.network_id`) and
// becomes the EMBEDDED it is in Signum — flattened onto the service row as `network_*` columns.
//
// The ordinary `sync` would add those columns and drop the table in the same script, losing every
// configured host/port/credential; and it would drop the client-certification rows, whose back reference
// moves from the network row to the SERVICE. So this runs FIRST (idempotent, one transaction): it creates
// the new columns and table, copies the values across, and leaves the old objects for the sync to remove.
//
// A SIGNUM database needs none of it — there the columns were never anywhere else, which is the whole
// reason the type was converted.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/migrateSmtpNetwork.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { Transaction } from "@altea/altea/server/connection/transaction";

async function count(sql: string, parameters: unknown[] = []): Promise<number> {
    const rows = await Connector.current().executeQuery(sql, parameters) as { n: number }[];
    return Number(rows[0]?.n ?? 0);
}

async function tableExists(schema: string, name: string): Promise<boolean> {
    return await count(`SELECT COUNT(*)::int AS n FROM information_schema.tables`
        + ` WHERE table_schema = $1 AND table_name = $2`, [schema, name]) > 0;
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!, undefined, { initialize: false });

    if (!await tableExists("mailing", "smtp_network_delivery_embedded")) {
        console.log("[smtp-network] nothing to migrate — the table is already gone.");
        return done();
    }

    await Transaction.create(async () => {
        // 1. The flattened columns. `IF NOT EXISTS` keeps the whole migration re-runnable.
        for (const [col, type] of [
            ["network_has_value", "bool"], ["network_host", "varchar"], ["network_port", "int4"],
            ["network_username", "varchar"], ["network_password", "varchar"],
            ["network_use_default_credentials", "bool"], ["network_enable_ssl", "bool"],
        ] as const)
            await Connector.current().executeNonQuery(`ALTER TABLE mailing.smtp_email_service ADD COLUMN IF NOT EXISTS ${col} ${type} NULL`);

        // 2. Copy each service's network row onto the service itself. has_value is what an embedded's
        //    presence IS, so a service with no network row keeps it false.
        await Connector.current().executeNonQuery(`UPDATE mailing.smtp_email_service s SET
                network_has_value = true,
                network_host = n.host,
                network_port = n.port,
                network_username = n.username,
                network_password = n.password,
                network_use_default_credentials = n.use_default_credentials,
                network_enable_ssl = n.enable_ssl
            FROM mailing.smtp_network_delivery_embedded n
            WHERE s.network_id = n.id`);
        await Connector.current().executeNonQuery(`UPDATE mailing.smtp_email_service
            SET network_has_value = false WHERE network_has_value IS NULL`);

        // 3. The client-certification rows move with it: same rows, but the back reference now names the
        //    SERVICE (an embedded has no id to point at).
        await Connector.current().executeNonQuery(`CREATE TABLE IF NOT EXISTS mailing.client_certification_file(
                id int4 GENERATED ALWAYS AS IDENTITY NOT NULL,
                service_id int4 NOT NULL,
                full_file_path varchar NOT NULL,
                CONSTRAINT pk_client_certification_file PRIMARY KEY (id)
            )`);
        if (await tableExists("mailing", "smtp_network_delivery_embedded__client_certification_file"))
            await Connector.current().executeNonQuery(`INSERT INTO mailing.client_certification_file (service_id, full_file_path)
                SELECT s.id, c.full_file_path
                FROM mailing.smtp_network_delivery_embedded__client_certification_file c
                JOIN mailing.smtp_email_service s ON s.network_id = c.network_id
                WHERE NOT EXISTS (
                    SELECT 1 FROM mailing.client_certification_file n
                    WHERE n.service_id = s.id AND n.full_file_path = c.full_file_path)`);

        const moved = await count(`SELECT COUNT(*)::int AS n FROM mailing.smtp_email_service WHERE network_has_value`);
        const certs = await count(`SELECT COUNT(*)::int AS n FROM mailing.client_certification_file`);
        console.log(`[smtp-network] ${moved} service(s) flattened, ${certs} certification file(s) re-pointed.`);
        console.log("[smtp-network] now run 'sync' — it has only the old table and column left to drop.");
    });

    return done();
}

function done(): void {
    void Connector.current().closeConnection();
}

void main();
