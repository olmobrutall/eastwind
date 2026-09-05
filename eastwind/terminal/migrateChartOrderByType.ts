// DATA migration for an existing ALTEA database: `ChartColumnEmbedded.orderByType` stops being a plain
// string column (`element_order_by_type varchar`, the shape a field typed with the string UNION
// `OrderTypeKeys` gets) and becomes the REFLECTED enum Signum declares (`OrderType? OrderByType`), so the
// column is an FK to the enum table — `element_order_by_type_id` → `basics.order_type(id)`.
//
// The ordinary `sync` would ADD the new column and DROP the old one in the same script, so every chart
// column that is SORTED silently loses its direction — the chart then renders in the query's own order
// with no error anywhere. This runs FIRST (idempotent, one transaction): it creates the new column and
// fills it by matching the stored NAME against the enum table, and leaves the old column for the sync.
//
// A SIGNUM database needs none of it: there the column has always been the FK, which is the whole point.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/migrateChartOrderByType.js
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

    if (!await columnExists("chart", "user_chart__column", "element_order_by_type")) {
        console.log("[order-by-type] nothing to migrate — the string column is already gone.");
        return done();
    }

    await Transaction.create(async () => {
        // 1. The FK column. `IF NOT EXISTS` keeps the whole migration re-runnable.
        await Connector.current().executeNonQuery(
            `ALTER TABLE chart.user_chart__column ADD COLUMN IF NOT EXISTS element_order_by_type_id int4 NULL`);

        // 2. Match the stored NAME against the enum table. A row whose direction was never set stays NULL,
        //    which is what a nullable enum means.
        await Connector.current().executeNonQuery(`UPDATE chart.user_chart__column c
            SET element_order_by_type_id = t.id
            FROM basics.order_type t
            WHERE c.element_order_by_type IS NOT NULL AND t.name = c.element_order_by_type`);

        const moved = await count(
            `SELECT COUNT(*)::int AS n FROM chart.user_chart__column WHERE element_order_by_type_id IS NOT NULL`);
        const orphan = await count(`SELECT COUNT(*)::int AS n FROM chart.user_chart__column`
            + ` WHERE element_order_by_type IS NOT NULL AND element_order_by_type_id IS NULL`);
        console.log(`[order-by-type] ${moved} sorted column(s) converted.`);
        if (orphan > 0)
            console.log(`[order-by-type] WARNING: ${orphan} row(s) hold a name basics.order_type does not have — they will lose it.`);
        console.log("[order-by-type] now run 'sync' — it has only the old column left to drop.");
    });

    return done();
}

function done(): void {
    void Connector.current().closeConnection();
}

void main();
