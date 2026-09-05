// DATA migration for an existing ALTEA database: each module configuration's `defaultCulture` stops being a
// plain locale string and becomes the `CultureInfoEntity` reference Signum declares — so
// `application_configuration.email_default_culture varchar` becomes `email_default_culture_id int4` →
// `basics.culture_info(id)`, and likewise `sms_default_culture`.
//
// The ordinary `sync` would ADD the FK column and DROP the varchar in the same script, and the FK is NOT
// NULL: the new column arrives filled with a default of 0, which is not a culture row, so the settings row
// comes back pointing at nothing and every template falls back to a culture that does not exist. This runs
// FIRST (idempotent, one transaction): it creates the two columns and fills them by matching the stored TAG
// against basics.culture_info.name, and leaves the varchars for the sync.
//
// A SIGNUM database needs none of it: there the column has always been the FK, which is the whole point.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/migrateDefaultCulture.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { Transaction } from "@altea/altea/server/connection/transaction";

/** The two configurations that carry one, as `<embedded prefix>_default_culture`. */
const MEMBERS = ["email", "sms"];

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

    const pending: string[] = [];
    for (const m of MEMBERS)
        if (await columnExists("public", "application_configuration", `${m}_default_culture`))
            pending.push(m);

    if (pending.length == 0) {
        console.log("[default-culture] nothing to migrate — the string columns are already gone.");
        return done();
    }

    await Transaction.create(async () => {
        for (const m of pending) {
            // 1. The FK column, NULLABLE here: the sync is what makes it NOT NULL, once it is filled.
            //    `IF NOT EXISTS` keeps the whole migration re-runnable.
            await Connector.current().executeNonQuery(`ALTER TABLE public.application_configuration`
                + ` ADD COLUMN IF NOT EXISTS ${m}_default_culture_id int4 NULL`);

            // 2. Match the stored TAG against the supported-culture table.
            await Connector.current().executeNonQuery(`UPDATE public.application_configuration c
                SET ${m}_default_culture_id = ci.id
                FROM basics.culture_info ci
                WHERE c.${m}_default_culture IS NOT NULL AND ci.name = c.${m}_default_culture`);

            const moved = await count(`SELECT COUNT(*)::int AS n FROM public.application_configuration`
                + ` WHERE ${m}_default_culture_id IS NOT NULL`);
            const orphan = await count(`SELECT COUNT(*)::int AS n FROM public.application_configuration`
                + ` WHERE ${m}_default_culture IS NULL OR ${m}_default_culture_id IS NULL`);
            console.log(`[default-culture] ${m}: ${moved} configuration row(s) converted.`);
            // The column is NOT NULL in the model, so a row the sync cannot fill would fail the ALTER —
            // say so HERE, where the tag that has no row is still readable.
            if (orphan > 0)
                console.log(`[default-culture] WARNING: ${m}: ${orphan} row(s) name a culture basics.culture_info`
                    + ` does not have. Add it (or set the column) before running 'sync'.`);
        }
        console.log("[default-culture] now run 'sync' — it has only the old columns left to drop.");
    });

    return done();
}

function done(): void {
    void Connector.current().closeConnection();
}

void main();
