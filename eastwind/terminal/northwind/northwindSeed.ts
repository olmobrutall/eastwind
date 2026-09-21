import * as fs from "node:fs";
import { Connector } from "@altea/altea/server/connection/connector";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { Northwind } from "./northwindSchema";
import { terminalFile } from "../terminalFile";

/**
 * Seed the Northwind SOURCE database — the demo data every `Load*` step reads through the `Nw*` views.
 *
 * A port normally assumes a Northwind database is already there (the SQL Server sample
 * everyone had installed). eastwind runs on both dialects, so it ships both vendor scripts and seeds
 * whichever one matches `NORTHWIND_DB`:
 *
 *   • `Northwind.SqlServer.sql` — Microsoft's `instnwnd.sql`, batches separated by `GO`.
 *   • `Northwind.Postgree.sql`  — the widely-used pg_dump port, statements separated by `;`.
 *
 * Both run VERBATIM. This module only SPLITS them into the units a driver accepts — neither driver takes a
 * script containing `GO`, and node-postgres will not take several statements in one parameterised call — so
 * there is no SQL rewriting here at all. The two things the scripts disagree about are settled elsewhere,
 * each in the one place that knows about it:
 *
 *   • NAMING — the SQL Server script is PascalCase under `dbo`, the pg_dump is snake_case under `public`.
 *     The views are declared in Northwind's own SQL Server spelling and `NorthwindPostgresViewBuilder`
 *     (northwindSchema.ts) remaps them for the Postgres source, through ViewBuilder's `tableName` /
 *     `columnName` hooks.
 *   • IMAGES — `Categories.Picture` / `Employees.Photo` are ~700 KB of OLE-wrapped bitmap in the SQL Server
 *     script and empty in the pg_dump. Neither column is MAPPED by any view, so whatever a script puts
 *     there is simply never read; the pictures come from `image_categories/` + `image_photos/` instead
 *     (northwindImages.ts), which is the same bytes on both dialects.
 *
 * Idempotent: both scripts drop what they create, so re-seeding replaces the data. The DATABASE itself must
 * already exist — altea has no CREATE DATABASE (the same rule as `terminal new`).
 */
export namespace NorthwindSeed {

    export async function seed(): Promise<void> {
        const connector = await Northwind.connector();
        const label = connector.isPostgres ? "PostgreSQL" : "SQL Server";
        const script = connector.isPostgres ? "Northwind.Postgree.sql" : "Northwind.SqlServer.sql";
        const file = terminalFile("northwind", script);

        if (!fs.existsSync(file))
            throw new Error(`Northwind seed script not found: ${file}`);

        const text = fs.readFileSync(file, "utf8");
        const statements = connector.isPostgres ? postgresStatements(text) : sqlServerBatches(text);

        console.log(`[northwind] seeding ${label} from ${script} — ${statements.length} batches`);

        // ONE pinned connection for the whole seed, and no enclosing transaction. Pinned because the SQL
        // Server script leans on connection-scoped state — `set identity_insert "Categories" on` applies to
        // the CONNECTION, so its INSERTs have to land on the same one, which an arbitrary pooled connection
        // per statement would not guarantee. Autocommit (`Transaction.none`) rather than a real transaction
        // because this is DDL: SQL Server auto-commits some of it regardless, and a failure half-way is
        // recovered by re-running the seed, not by a rollback.
        await Connector.withConnector(connector, () => Transaction.none(async () => {
            let done = 0;
            for (const sql of statements) {
                try {
                    await connector.executeNonQuery(sql);
                } catch (e) {
                    throw new Error(`Northwind seed failed on batch ${done + 1} of ${statements.length}:\n`
                        + firstLines(sql) + `\n${(e as Error)?.message ?? String(e)}`, { cause: e });
                }
                if (++done % 100 === 0)
                    console.log(`  [northwind] ${done}/${statements.length}`);
            }
        }));

        console.log(`[northwind] seeded ${statements.length} batches into ${label}`);
    }
}

/**
 * Split `instnwnd.sql` on its `GO` separators. `GO` is a client-side batch terminator, not T-SQL — the
 * driver rejects a script containing it — and the batches are load-bearing here: `CREATE PROCEDURE` has to
 * be the first statement of its batch, and `set identity_insert` has to precede the INSERTs it enables.
 */
function sqlServerBatches(text: string): string[] {
    const batches: string[] = [];
    let current: string[] = [];
    const flush = (): void => {
        const sql = current.join("\n").trim();
        if (sql.length > 0)
            batches.push(sql);
        current = [];
    };

    // A `GO` line separates batches only OUTSIDE a string literal — tracked so a value that happens to hold
    // a lone "GO" line cannot split a statement in half.
    let inString = false;
    for (const line of text.split(/\r?\n/)) {
        if (!inString && /^\s*GO\s*(--.*)?$/i.test(line)) {
            flush();
            continue;
        }
        current.push(line);
        inString = scanLine(line, inString);
    }
    flush();
    return batches;
}

/**
 * Split the pg_dump on its top-level `;`. One statement per call, because node-postgres sends anything with
 * a parameter array through the extended protocol, which takes a single statement only.
 *
 * ONE statement is dropped, and it is the only thing in either script that is not run as written: `SET
 * default_with_oids` names a parameter PostgreSQL REMOVED in 12, so a modern server rejects it outright.
 */
function postgresStatements(text: string): string[] {
    return splitOnSemicolons(text).filter(sql => !/^SET\s+default_with_oids\b/i.test(sql));
}

/**
 * Split on top-level `;`, skipping the ones inside a string literal or a `--` comment. Comment-only and
 * blank fragments are dropped.
 */
function splitOnSemicolons(text: string): string[] {
    const statements: string[] = [];
    let current = "";
    let inString = false;

    for (const line of text.split(/\r?\n/)) {
        let rest = line;
        for (; ;) {
            const cut = inString ? -1 : indexOfTopLevelSemicolon(rest);
            if (cut < 0) {
                current += (current === "" ? "" : "\n") + rest;
                inString = scanLine(rest, inString);
                break;
            }
            current += (current === "" ? "" : "\n") + rest.slice(0, cut);
            push(statements, current);
            current = "";
            rest = rest.slice(cut + 1);
        }
    }
    push(statements, current);
    return statements;
}

// Index of the first `;` outside a string literal / `--` comment, on a line that STARTS outside a string.
function indexOfTopLevelSemicolon(line: string): number {
    let inString = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inString) {
            if (c === "'") {
                if (line[i + 1] === "'") i++; // an escaped quote inside the literal
                else inString = false;
            }
        } else if (c === "'") {
            inString = true;
        } else if (c === "-" && line[i + 1] === "-") {
            return -1; // the rest of the line is a comment
        } else if (c === ";") {
            return i;
        }
    }
    return -1;
}

// Does `line` leave a string literal OPEN? (`''` is an escaped quote; `--` starts a comment.)
function scanLine(line: string, inString: boolean): boolean {
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inString) {
            if (c === "'") {
                if (line[i + 1] === "'") i++;
                else inString = false;
            }
        } else if (c === "'") {
            inString = true;
        } else if (c === "-" && line[i + 1] === "-") {
            return false;
        }
    }
    return inString;
}

function push(statements: string[], candidate: string): void {
    // Drop whole-line `--` comments and blank lines, then keep whatever statement is left.
    const sql = candidate.split(/\r?\n/).filter(l => !/^\s*(--.*)?$/.test(l)).join("\n").trim();
    if (sql.length > 0)
        statements.push(sql);
}

/** The head of a failing batch, for the error message — a batch can be thousands of INSERTs long. */
function firstLines(sql: string, count = 3): string {
    const lines = sql.split("\n");
    return lines.slice(0, count).map(l => "    " + l.slice(0, 200)).join("\n")
        + (lines.length > count ? `\n    … (${lines.length - count} more lines)` : "");
}
