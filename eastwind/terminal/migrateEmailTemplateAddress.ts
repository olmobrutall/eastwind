// DATA migration for an existing ALTEA database: an EmailTemplate's `From` and its `Recipients` stop being
// `@part` ENTITY rows and become the EMBEDDEDs Signum declares (`EmailTemplateAddressEmbedded` and its two
// subclasses). Two shapes move:
//
//   - `From` was a side table reached by `email_template.from_id`; it is now FLATTENED onto the template
//     (`from_address_source_id`, `from_when_none_id`, … plus the `from_has_value` indicator).
//   - a Recipient row now WRAPS the embedded in its `element` field, so the row's own columns become
//     `element_*` — which is what makes legacy mode inline them unprefixed, as Signum's
//     `email_template_recipients` does.
//
// The ordinary `sync` would add each new column, drop the old ones and DROP the from table in one script,
// so every template loses who it is sent FROM and every recipient loses its address, kind and behaviours —
// leaving templates that look configured and cannot send. This runs FIRST (idempotent, one transaction):
// it creates the new columns and copies the values across, and leaves the old ones for the sync.
//
// A SIGNUM database needs none of it — there both have always been embeddeds, which is the whole point.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/migrateEmailTemplateAddress.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { Transaction } from "@altea/altea/server/connection/transaction";

async function count(sql: string, parameters: unknown[] = []): Promise<number> {
    const rows = await Connector.current().executeQuery(sql, parameters) as { n: number }[];
    return Number(rows[0]?.n ?? 0);
}

async function columnExists(schema: string, table: string, column: string): Promise<boolean> {
    return await count(`SELECT COUNT(*)::int AS n FROM information_schema.columns`
        + ` WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`, [schema, table, column]) > 0;
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!, undefined, { initialize: false });

    if (!await columnExists("mailing", "email_template", "from_id")) {
        console.log("[email-address] nothing to migrate — the From side table is already gone.");
        return done();
    }

    await Transaction.create(async () => {
        // ---- From: a side table folded onto the owner's row --------------------------------------------
        for (const [col, type] of [
            ["from_has_value", "bool"], ["from_address_source_id", "int4"], ["from_email_address", "varchar"],
            ["from_display_name", "varchar"], ["from_token_has_value", "bool"], ["from_token_token_string", "varchar"],
            ["from_when_none_id", "int4"], ["from_when_many_id", "int4"], ["from_azure_user_id", "varchar"],
        ] as const)
            await Connector.current().executeNonQuery(
                `ALTER TABLE mailing.email_template ADD COLUMN IF NOT EXISTS ${col} ${type} NULL`);

        await Connector.current().executeNonQuery(`UPDATE mailing.email_template t SET
                from_has_value = true,
                from_address_source_id = f.address_source_id,
                from_email_address = f.email_address,
                from_display_name = f.display_name,
                from_token_has_value = f.token_has_value,
                from_token_token_string = f.token_token_string,
                from_when_none_id = f.when_none_id,
                from_when_many_id = f.when_many_id,
                from_azure_user_id = f.azure_user_id
            FROM mailing.email_template__from f
            WHERE t.from_id = f.id`);
        // has_value is what an embedded's PRESENCE is, so a template with no From keeps it false.
        await Connector.current().executeNonQuery(
            `UPDATE mailing.email_template SET from_has_value = false WHERE from_has_value IS NULL`);

        // ---- Recipients: the row's own members become the element's ------------------------------------
        for (const [col, type] of [
            ["element_address_source_id", "int4"], ["element_email_address", "varchar"],
            ["element_display_name", "varchar"], ["element_token_has_value", "bool"],
            ["element_token_token_string", "varchar"], ["element_kind_id", "int4"],
            ["element_when_none_id", "int4"], ["element_when_many_id", "int4"],
        ] as const)
            await Connector.current().executeNonQuery(
                `ALTER TABLE mailing.email_template__recipient ADD COLUMN IF NOT EXISTS ${col} ${type} NULL`);

        await Connector.current().executeNonQuery(`UPDATE mailing.email_template__recipient SET
                element_address_source_id = address_source_id,
                element_email_address = email_address,
                element_display_name = display_name,
                element_token_has_value = token_has_value,
                element_token_token_string = token_token_string,
                element_kind_id = kind_id,
                element_when_none_id = when_none_id,
                element_when_many_id = when_many_id`);

        const froms = await count(`SELECT COUNT(*)::int AS n FROM mailing.email_template WHERE from_has_value`);
        const recipients = await count(`SELECT COUNT(*)::int AS n FROM mailing.email_template__recipient`);
        console.log(`[email-address] ${froms} From address(es) flattened, ${recipients} recipient(s) re-shaped.`);
        console.log("[email-address] now run 'sync' — it has only the old columns and the From table left to drop.");
    });

    return done();
}

function done(): void {
    void Connector.current().closeConnection();
}

void main();
