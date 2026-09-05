// DATA migration for an existing ALTEA database: `OfficeTemplateEntity.template` stops being a
// `FileEmbedded` — the .docx/.pptx/.xlsx bytes inline in `word.office_template` — and becomes the
// FileEntity REFERENCE Signum declares, so the column is `template_id` into `files.file`.
//
// The ordinary `sync` would add `template_id` and drop `template_binary_file` in the same script, so every
// template loses its DOCUMENT: the row survives, its name and filters and tokens survive, and rendering a
// report then fails on an empty template. This runs FIRST (idempotent, one transaction): it creates one
// `files.file` row per template from the inline bytes and points the template at it, leaving the old
// columns for the sync.
//
// The HASH is the file's cache identity (it rides the download url and becomes the ETag), so it is
// computed the way `calculateMD5Hash` does — base64 of the MD5 — rather than left for a later save to fix.
// Postgres' own `md5()` returns hex, hence the decode/encode pair; no pgcrypto needed.
//
// A SIGNUM database needs none of it: there the template has always been a file row.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/migrateOfficeTemplateFile.js
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

    if (!await columnExists("word", "office_template", "template_binary_file")) {
        console.log("[office-template] nothing to migrate — the inline bytes are already gone.");
        return done();
    }

    await Transaction.create(async () => {
        await Connector.current().executeNonQuery(
            `ALTER TABLE word.office_template ADD COLUMN IF NOT EXISTS template_id int4 NULL`);

        // One file row per template that has not been converted yet, then point the template at it. The
        // two statements are separate because the INSERT has to hand back an id per template.
        await Connector.current().executeNonQuery(`WITH inserted AS (
                INSERT INTO files.file (file_name, hash, binary_file)
                SELECT t.template_file_name,
                       encode(decode(md5(t.template_binary_file), 'hex'), 'base64'),
                       t.template_binary_file
                FROM word.office_template t
                WHERE t.template_id IS NULL
                RETURNING id, hash
            )
            SELECT 1`);

        // Match each template back to its file by (name, hash) — the pair the INSERT above wrote.
        await Connector.current().executeNonQuery(`UPDATE word.office_template t
            SET template_id = f.id
            FROM files.file f
            WHERE t.template_id IS NULL
              AND f.file_name = t.template_file_name
              AND f.hash = encode(decode(md5(t.template_binary_file), 'hex'), 'base64')`);

        const moved = await count(`SELECT COUNT(*)::int AS n FROM word.office_template WHERE template_id IS NOT NULL`);
        const missing = await count(`SELECT COUNT(*)::int AS n FROM word.office_template WHERE template_id IS NULL`);
        console.log(`[office-template] ${moved} template document(s) moved into files.file.`);
        if (missing > 0)
            console.log(`[office-template] WARNING: ${missing} template(s) still have no file — they would lose their document.`);
        console.log("[office-template] now run 'sync' — it has only the two inline columns left to drop.");
    });

    return done();
}

function done(): void {
    void Connector.current().closeConnection();
}

void main();
