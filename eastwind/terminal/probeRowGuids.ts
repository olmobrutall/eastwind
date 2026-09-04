// The uuid row id of a user-asset COLLECTION, and the XML round-trip it exists for.
//
// Signum declares nine of those collections `[PrimaryKey(typeof(Guid))]` with the reason in a comment —
// "the row id identifies the element in the XML" — writes that id per row on export, and matches on it on
// import instead of matching by POSITION. This pins the behaviour that buys, because none of it is visible
// from the schema alone:
//
//   * a re-import of an UNCHANGED asset reuses every row, so no row is rewritten;
//   * a re-import that REORDERS the rows still reuses them, rather than renumbering everything after the
//     first move (which is what positional matching does);
//   * a row the database does not have arrives carrying the id from the file, so the same file imported
//     into another database yields the same ids;
//   * a file with NO Guid at all still imports, by position, so an older export is not a change;
//   * a file where only SOME rows carry one is refused rather than half-applied.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeRowGuids.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { Schema } from "@altea/altea/server/schema/schema";
import { guidKeyDefault } from "@altea/altea/server/schema/schemaBuilder";
import { syncRows, rowGuid, UserAssetsImporter, warmUserAssetCaches } from "@altea/altea-user-assets/server/UserAssetsImportExport.server";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { table } from "@altea/altea/server/table";
import { toInt } from "@altea/altea/data/basics";
import { UserQueryEntity } from "@altea/altea-user-queries/data/UserQuery";
import { UserQueryEntity_Filter, UserQueryEntity_Column } from "@altea/altea-user-queries/data/UserQuery";
import { UserChartEntity_Filter, UserChartEntity_Column } from "@altea/altea-chart/data/UserChart";
import { DashboardEntity_Part } from "@altea/altea-dashboard/data/Dashboard";
import { ToolbarEntity_Element, ToolbarMenuEntity_Element } from "@altea/altea-toolbar/data/Toolbar";
import { EmailTemplateEntity_Filter } from "@altea/altea-email/data/EmailTemplate";
import { OfficeTemplateEntity_Filter } from "@altea/altea-office-template/data/OfficeTemplate";
import { HolidayCalendarEntity } from "@altea/altea-scheduler/data/HolidayCalendar";
import {
    ScheduleRuleMinutelyEntity, ScheduleRuleWeekDaysEntity, ScheduleRuleMonthsEntity,
} from "@altea/altea-scheduler/data/Scheduler";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

/** A stand-in collection row: one field, so a "changed" row is observable. */
class Row extends UserQueryEntity_Column { }

function el(guid: string | undefined, name: string): Record<string, unknown> {
    return guid == undefined ? { Name: name } : { Guid: guid, Name: name };
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    // ---- every collection Signum gives a Guid PK has one here ------------------------------------------
    const uuidPk: [string, Function][] = [
        ["UserQueryEntity_Filter", UserQueryEntity_Filter],
        ["UserQueryEntity_Column", UserQueryEntity_Column],
        ["UserChartEntity_Filter", UserChartEntity_Filter],
        ["UserChartEntity_Column", UserChartEntity_Column],
        ["DashboardEntity_Part", DashboardEntity_Part],
        ["ToolbarEntity_Element", ToolbarEntity_Element],
        ["ToolbarMenuEntity_Element", ToolbarMenuEntity_Element],
        ["EmailTemplateEntity_Filter", EmailTemplateEntity_Filter],
        ["OfficeTemplateEntity_Filter", OfficeTemplateEntity_Filter],
        ["HolidayCalendarEntity", HolidayCalendarEntity],
        ["ScheduleRuleMinutelyEntity", ScheduleRuleMinutelyEntity],
        ["ScheduleRuleWeekDaysEntity", ScheduleRuleWeekDaysEntity],
        ["ScheduleRuleMonthsEntity", ScheduleRuleMonthsEntity],
    ];

    for (const [name, ctor] of uuidPk) {
        const t = Schema.current.table(ctor as never);
        const dbType = t.primaryKey.column.dbType.toString();
        check(`${name} has a uuid primary key`, dbType.includes("uuid") || dbType.includes("uniqueidentifier"), dbType);
    }

    // The redundant `guid` column those three carried is gone — the PK IS the guid now.
    for (const [name, ctor] of [["DashboardEntity_Part", DashboardEntity_Part],
        ["ToolbarEntity_Element", ToolbarEntity_Element],
        ["ToolbarMenuEntity_Element", ToolbarMenuEntity_Element]] as [string, Function][]) {
        const columns = Object.keys(Schema.current.table(ctor as never).columns).map(c => c.toLowerCase());
        check(`${name} has no separate guid column`, !columns.includes("guid"), columns.join(", "));
    }

    // ---- the generator behind a uuid key -------------------------------------------------------------
    // The key is TIME-ORDERED, which is what Signum emits too: `uuidv7()` on PostgreSQL, NEWSEQUENTIALID on
    // SQL Server. A random key scatters inserts across the whole index.
    const expected = Connector.current().sqlBuilder.isPostgres ? "uuidv7()" : "NEWSEQUENTIALID()";
    for (const [name, ctor] of uuidPk) {
        const col = Schema.current.table(ctor as never).primaryKey.column;
        check(`${name}'s key is generated by ${expected}`, col.default === expected, col.default ?? "(no default)");
    }

    // …and the choice follows the SERVER, not a flag: `uuidv7()` is native from PostgreSQL 18, and an
    // older server falls back to `uuid_generate_v1()` (uuid-ossp), which is what Signum defaulted to
    // before it moved to v7. An UNKNOWN version reads as modern, exactly as Signum's null version does.
    check("the generator follows the server version",
        guidKeyDefault(true, "uuid") === (Connector.default!.supportsUuidV7 ? "uuidv7()" : "uuid_generate_v1()"));
    check("SQL Server keeps Signum's NEWID() for a uuid key", guidKeyDefault(false, "uuid") === "NEWID()");
    check("…and NEWSEQUENTIALID() for the uuid7 key type", guidKeyDefault(false, "uuid7") === "NEWSEQUENTIALID()");

    // ---- rowGuid: what the exporter writes ------------------------------------------------------------
    const saved = new Row();
    saved.id = "11111111-1111-1111-1111-111111111111" as never;
    check("rowGuid writes the row's own id", rowGuid(saved)["@_Guid"] === "11111111-1111-1111-1111-111111111111",
        JSON.stringify(rowGuid(saved)));
    check("rowGuid writes nothing for an unsaved row", Object.keys(rowGuid(new Row())).length === 0);

    // ---- matching by row id --------------------------------------------------------------------------
    const A = "aaaaaaaa-0000-0000-0000-000000000001";
    const B = "bbbbbbbb-0000-0000-0000-000000000002";
    const C = "cccccccc-0000-0000-0000-000000000003";

    const rowA = new Row(); rowA.id = A as never; rowA.displayName = "a";
    const rowB = new Row(); rowB.id = B as never; rowB.displayName = "b";

    // 1. an UNCHANGED re-import reuses the very same instances.
    const same = syncRows([rowA, rowB], [el(A, "a"), el(B, "b")], () => new Row(),
        (r, x) => { r.displayName = String(x["Name"]); });
    check("an unchanged re-import reuses both rows", same[0] === rowA && same[1] === rowB);

    // 2. REORDERED still reuses them — the thing positional matching cannot do.
    const swapped = syncRows([rowA, rowB], [el(B, "b"), el(A, "a")], () => new Row(),
        (r, x) => { r.displayName = String(x["Name"]); });
    check("a reordered import reuses the rows, in the new order",
        swapped[0] === rowB && swapped[1] === rowA);

    // 3. a row the database does not have KEEPS the id from the file, so the same file lands identically
    //    in another database.
    const added = syncRows([rowA], [el(A, "a"), el(C, "c")], () => new Row(),
        (r, x) => { r.displayName = String(x["Name"]); });
    check("a new row keeps the id from the file", String(added[1]!.id) === C, String(added[1]!.id));
    check("and is new, so the save inserts it", added[1]!.isNew);
    check("while the matched row is untouched", added[0] === rowA);

    // 4. a REMOVED row is dropped.
    const removed = syncRows([rowA, rowB], [el(B, "b")], () => new Row(),
        (r, x) => { r.displayName = String(x["Name"]); });
    check("a row missing from the file is dropped", removed.length === 1 && removed[0] === rowB);

    // 5. the sync callback still sees the INDEX (Signum's reason: state that depends on position).
    const indexes: number[] = [];
    syncRows([rowA, rowB], [el(B, "b"), el(A, "a")], () => new Row(), (_r, _x, i) => { indexes.push(i); });
    check("the callback receives the element index", indexes.join(",") === "0,1", indexes.join(","));

    // 6. an OLD file with no Guid at all falls back to positional matching, so it is not a change.
    const positional = syncRows([rowA, rowB], [el(undefined, "a"), el(undefined, "b")], () => new Row(),
        (r, x) => { r.displayName = String(x["Name"]); });
    check("a file with no Guid matches by position", positional[0] === rowA && positional[1] === rowB);

    // 7. a HALF-annotated file is refused rather than half-applied.
    let refused = false;
    try {
        syncRows([rowA], [el(A, "a"), el(undefined, "b")], () => new Row(), () => { });
    } catch (e) {
        refused = String(e).includes("Guid");
    }
    check("a file where only some rows carry a Guid is refused", refused);

    // 8. an EMPTY file clears the collection (and undefined is treated as empty).
    check("no elements clears the collection",
        syncRows([rowA], [], () => new Row(), () => { }).length === 0);
    check("undefined elements clears the collection",
        syncRows([rowA], undefined, () => new Row(), () => { }).length === 0);

    // ---- end to end: export a real UserQuery and import it back --------------------------------------
    // Everything above is the algorithm; this is the path a user takes. A re-import of an asset's own
    // export must leave its rows exactly as they were, ids included.
    // Ordered, so the probe reports the same checks on every run.
    const uq = (await ExecutionMode.global(() => table(UserQueryEntity)
        .filter(q => q.columns.length > toInt(0)).orderBy(q => q.displayName).toArray()) as UserQueryEntity[])[0];

    if (uq == undefined) {
        console.log("  (skipped the round-trip — no UserQuery with columns in this database)");
    } else {
        const before = {
            filters: uq.filters.map(f => String(f.id)),
            columns: uq.columns.map(c => String(c.id)),
        };

        const xml = await ExecutionMode.global(() => UserAssetsImporter.toXml([uq]));
        check("the export carries a Guid per collection row",
            (xml.match(/<Column /g)?.length ?? 0) > 0 && xml.includes("Guid=") , "no Column elements or no Guid");

        const perColumn = [...xml.matchAll(/<Column [^>]*/g)].filter(m => m[0].includes("Guid="));
        check("EVERY exported column row carries one",
            perColumn.length === uq.columns.length, `${perColumn.length} of ${uq.columns.length}`);
        for (const id of before.columns)
            check(`the export names column ${id.slice(0, 8)}…`, xml.includes(id));

        // The importer resolves referenced queries/types from its own caches; the web host warms them at
        // boot, a terminal script has to.
        await ExecutionMode.global(() => warmUserAssetCaches());

        const model = await ExecutionMode.global(() => UserAssetsImporter.preview(xml));
        await ExecutionMode.global(() => UserAssetsImporter.importAssets(xml, model));

        const after = (await ExecutionMode.global(() => table(UserQueryEntity)
            .filter(q => q.id == uq.id).toArray()) as UserQueryEntity[])[0]!;

        check("the round-trip keeps every FILTER row id",
            after.filters.map(f => String(f.id)).join(",") === before.filters.join(","),
            `${after.filters.map(f => String(f.id)).join(",")} vs ${before.filters.join(",")}`);
        check("the round-trip keeps every COLUMN row id",
            after.columns.map(c => String(c.id)).join(",") === before.columns.join(","),
            `${after.columns.length} rows vs ${before.columns.length}`);
    }

    // ---- report ---------------------------------------------------------------------------------------
    console.log(`\n${pass} checks passed, ${failures.length} failed`);
    for (const f of failures)
        console.log("  FAIL " + f);

    await Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

void main();
