// Where each log table's BIG TEXT lives — Southwind's `Starter.ConfigureBigString`, ported into eastwind's
// own `configureBigString`. A `BigStringEmbedded` is a wrapper around one unbounded text column; with the
// BigStringMixin declared and a route configured `File`, the text is written to the file store on save and
// read back on retrieve, so nothing that reads `.text` changes — and the ROW keeps only the file's
// coordinates, which is what makes `basics.exception.stack_trace_file_hash` line up with a Signum database
// instead of altea's `stack_trace_text`.
//
// Worth a probe because the feature had never been exercised: two defects only a real save/retrieve shows.
//   - `File` mode wrote NOTHING on an INSERT. Signum tests `bs.Modified == SelfModified` and a freshly
//     constructed ModifiableEntity IS SelfModified there; altea reads an embedded with no baseline as CLEAN,
//     so a new row's text was silently dropped. `entity.isNew` is the other half of that question.
//   - `registerAll` skipped every MIXIN-contributed route (OperationLog's DiffLog dumps, EmailMessage's
//     reception raw content), so the schema check refused to start. Signum's RegisterAll covers them,
//     because PropertyRoute.GenerateRoutes walks mixins.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeBigString.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { Schema } from "@altea/altea/server/schema/schema";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { table } from "@altea/altea/server/table";
import { retrieve } from "@altea/altea/server/Database";
import { Temporal } from "@altea/altea/data/basics";
import { ExceptionEntity } from "@altea/altea/data/exception";
import { OperationLogEntity } from "@altea/altea/data/operationLog";
import { BigStringEmbedded } from "@altea/altea/data/bigString";
import { BigStringMixin } from "@altea/altea-files/data/BigString";
import { BigStringLogic } from "@altea/altea-files/server/BigStringLogic";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    // ---- the schema ---------------------------------------------------------------------------------
    // A `File` route keeps the file's coordinates and NOT the text — Signum's own column set.
    const columns = Object.keys(Schema.current.table(ExceptionEntity).columns).map(c => c.toLowerCase());
    check("a File route drops the text column", !columns.includes("stack_trace_text"),
        columns.filter(c => c.startsWith("stack_trace")).join(", "));
    check("and keeps the file's", ["stack_trace_file_hash", "stack_trace_file_suffix", "stack_trace_file_file_type_id"]
        .every(c => columns.includes(c)), columns.filter(c => c.startsWith("stack_trace")).join(", "));

    // Every one of ExceptionEntity's five BigString routes is configured, not just the one named.
    const configured = [...BigStringLogic.configurations.keys()].filter(k => k.startsWith("Exception."));
    check("registerAll covers every route of the type", configured.length === 5, configured.join(", "));

    // A MIXIN's routes are the type's own here (altea flattens them), so registerAll must reach them —
    // OperationLogEntity's two dumps come from altea-diff-log's mixin.
    const opLog = [...BigStringLogic.configurations.keys()].filter(k => k.startsWith("OperationLog."));
    check("including the ones a MIXIN contributes",
        opLog.includes("OperationLog.initialState") && opLog.includes("OperationLog.finalState"), opLog.join(", "));
    const opColumns = Object.keys(Schema.current.table(OperationLogEntity).columns).map(c => c.toLowerCase());
    check("so the mixin's text column is dropped too", !opColumns.includes("initial_state_text"),
        opColumns.filter(c => c.startsWith("initial_state")).join(", "));

    // A route left in the row costs nothing: no file columns at all (this is what `Database` mode is for,
    // and every BigString route altea has that Signum models as a plain string is registered that way).
    const inRow = [...BigStringLogic.configurations.entries()].filter(([, v]) => v.config.mode === "Database");
    check("the routes that stay in the row are registered Database", inRow.length > 0, String(inRow.length));

    // ---- the round trip, which is the part only a database shows -------------------------------------
    await ExecutionMode.global(async () => {
        const text = "STACK-TRACE-" + "x".repeat(500);
        const e = ExceptionEntity.create({
            creationDate: Temporal.PlainDateTime.from(new Date().toISOString().replace("Z", "")),
            exceptionType: "ProbeBigString",
            exceptionMessage: "probe",
            stackTrace: BigStringEmbedded.create({ text }),
        });

        // A file write joins the owner's transaction (the bytes land just before it commits), which is how
        // every real save reaches here — an operation, or ExceptionLogic.logException's own forceNew.
        await Transaction.forceNew(async () => { await e.save(); });

        const file = e.stackTrace.mixin(BigStringMixin).file;
        check("an INSERT writes the text to a file", file != null && file.suffix != null,
            JSON.stringify(file?.suffix));
        check("the row itself carries no text", e.stackTrace.text === text, "(the in-memory value is kept)");

        const back = await retrieve(ExceptionEntity, e.id);
        check("a retrieve reads it back from the file", back.stackTrace.text === text,
            `${back.stackTrace.text?.length ?? 0} chars`);

        // An UPDATE goes through the same path: the text changes, the file follows.
        const changed = text + "-UPDATED";
        back.stackTrace.text = changed;
        await Transaction.forceNew(async () => { await back.save(); });
        const back2 = await retrieve(ExceptionEntity, e.id);
        check("an UPDATE rewrites the file", back2.stackTrace.text === changed,
            `${back2.stackTrace.text?.length ?? 0} chars`);

        await Transaction.forceNew(async () => {
            await table(ExceptionEntity).filter(x => x.id == e.id).executeDelete();
        });
        check("the probe cleans up after itself",
            await table(ExceptionEntity).count(x => x.id == e.id) === 0);
    });

    return report();
}

function report(): void {
    console.log(`\n${pass} checks passed, ${failures.length} failed`);
    for (const f of failures)
        console.log("  FAIL " + f);
    void Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

void main();
