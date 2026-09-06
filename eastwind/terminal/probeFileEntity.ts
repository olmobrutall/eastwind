// FileEntity — FileEmbedded's contents in a table of its own, so several owners can reference one file
// (Signum's EntityKind.SharedPart). Three things make it more than a row with a blob in it, and each is a
// way it could silently misbehave: the hash must always follow the bytes, a SAVED file must be immutable
// (because changing it changes the file under every owner), and re-saving an UNCHANGED one must still work,
// since the owner's save walks the whole reachable graph.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeFileEntity.js
import { createHash } from "node:crypto";
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { retrieve, deleteList } from "@altea/altea/server/Database";
import { Schema } from "@altea/altea/server/schema/schema";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { PropertyRoute } from "@altea/altea/data/propertyRoute";
import { FileEntity } from "@altea/altea-files/data/Files";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

const md5 = (b: Uint8Array): string => createHash("md5").update(b).digest("base64");

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    // ---- the schema shape ------------------------------------------------------------------------
    const t = Schema.current.table(FileEntity);
    check("the table is included", t != null, String(t?.name));
    // Signum's [TicksColumn(false)]: an immutable row cannot be concurrently edited.
    check("no concurrency stamp", t.columns["ticks"] == null && t.columns["Ticks"] == null,
        Object.keys(t.columns).join(", "));

    const created: FileEntity[] = [];
    try {
        // ---- saving: the hash follows the bytes --------------------------------------------------
        const bytes = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        const file = FileEntity.create({ fileName: "probe.dat", binaryFile: bytes });
        check("hash is unset before saving", file.hash == null, String(file.hash));

        await ExecutionMode.global(async () => { await file.save(); });
        created.push(file);

        check("an id was assigned", file.id != null, String(file.id));
        check("the server computed the hash", file.hash === md5(bytes), `${file.hash} vs ${md5(bytes)}`);

        // ---- the bytes round-trip -----------------------------------------------------------------
        const read = await ExecutionMode.global(() => retrieve(FileEntity, file.id!)) as FileEntity;
        check("the file name round-trips", read.fileName === "probe.dat", read.fileName);
        check("the bytes round-trip exactly",
            read.binaryFile.length === bytes.length && read.binaryFile.every((v, i) => v === bytes[i]),
            `${read.binaryFile.length} bytes`);
        check("the stored hash matches the stored bytes", read.hash === md5(read.binaryFile),
            `${read.hash} vs ${md5(read.binaryFile)}`);

        // Signum's `ToString()` — "{name} - {computer size}".
        // Signum's abbreviation table starts with "Bytes" (capital B), which is what altea mirrors.
        check("toString names the file and its size", read.toString() === "probe.dat - 10 Bytes",
            read.toString());

        // ---- re-saving an UNCHANGED file is fine --------------------------------------------------
        // It has to be: the owner's save walks every reachable entity, so an untouched referenced file
        // passes through preSaving on every one of its owners' saves. The hash handler recomputes the SAME
        // value, and a value-equal write leaves the snapshot diff clean.
        let reSaveFailed: string | null = null;
        try {
            await ExecutionMode.global(async () => { await read.save(); });
        } catch (e) { reSaveFailed = (e as Error).message; }
        check("re-saving an unchanged file is allowed", reSaveFailed == null, reSaveFailed ?? "");

        // ---- immutability: the bytes -------------------------------------------------------------
        // Signum's ImmutableEntity.PreSaving. altea reports it LOUDLY where Signum's setter swallows the
        // change silently — see data/Files.ts.
        const toMutate = await ExecutionMode.global(() => retrieve(FileEntity, file.id!)) as FileEntity;
        toMutate.binaryFile = new Uint8Array([9, 9, 9]);
        let bytesRefused = false;
        try {
            await ExecutionMode.global(async () => { await toMutate.save(); });
        } catch { bytesRefused = true; }
        check("changing a saved file's BYTES is refused", bytesRefused);

        // ---- immutability: the name --------------------------------------------------------------
        const toRename = await ExecutionMode.global(() => retrieve(FileEntity, file.id!)) as FileEntity;
        toRename.fileName = "renamed.dat";
        let renameRefused = false;
        try {
            await ExecutionMode.global(async () => { await toRename.save(); });
        } catch { renameRefused = true; }
        check("renaming a saved file is refused", renameRefused);

        // ...and neither attempt reached the database.
        const after = await ExecutionMode.global(() => retrieve(FileEntity, file.id!)) as FileEntity;
        check("the stored row is untouched",
            after.fileName === "probe.dat" && after.binaryFile.length === bytes.length,
            `${after.fileName}, ${after.binaryFile.length} bytes`);

        // ---- SHARING: one file, two references ---------------------------------------------------
        // The whole reason this type exists. eastwind has no field holding one (its file fields are all
        // FileEmbedded, a documented divergence), so the sharing is shown the way a caller would use it:
        // one row, two independent lites, both naming the same file.
        const liteA = after.toLite();
        const liteB = (await ExecutionMode.global(() => retrieve(FileEntity, file.id!)) as FileEntity).toLite();
        check("two lites name the same row", liteA.key() === liteB.key(), `${liteA.key()} vs ${liteB.key()}`);
        check("the lite's toStr is the file's toString", liteA.toString() === after.toString(),
            `${liteA.toString()} vs ${after.toString()}`);

        // ---- a second, DIFFERENT file ------------------------------------------------------------
        const other = FileEntity.create({ fileName: "other.txt", binaryFile: new Uint8Array([42]) });
        await ExecutionMode.global(async () => { await other.save(); });
        created.push(other);
        check("a second file gets its own hash", other.hash !== after.hash, `${other.hash}`);
        check("the query sees both", (await ExecutionMode.global(() =>
            table(FileEntity).filter(f => f.id == file.id || f.id == other.id).toArray())).length === 2);

        // ---- ImmutableEntity: the ESCAPE HATCH ---------------------------------------------------
        // Signum's `AllowChange` / `AllowChanges()`, which is how WordTemplateLogic rewrites a template's
        // document in place. Exercised on `other`, so `file` stays the pristine subject of the checks above.
        //
        // The member is a real PROPERTY ROUTE — `File.AllowChange`, which a Signum database has a
        // property-authorization rule for — and NOT a column, which is the pair that makes it worth having:
        // the route is what a Southwind sync matches, and @column(false) keeps it out of both the table and
        // the change diff.
        check("allowChange is a property route", PropertyRoute.generateRoutes(FileEntity)
            .some(r => r.propertyString() === "allowChange"));
        check("allowChange is NOT a column", t.columns["allowChange"] == null && t.columns["AllowChange"] == null,
            Object.keys(t.columns).join(", "));

        // Setting it is not itself a change, because the field is outside change tracking — otherwise
        // ALLOWING a change would be one, and the guard could never be lifted without tripping itself.
        const flagged = await ExecutionMode.global(() => retrieve(FileEntity, other.id!)) as FileEntity;
        flagged.allowChange = true;
        check("setting allowChange does not make the row modified", !flagged.isModifiedSelf());

        // With it set, the change goes through — and reaches the database.
        flagged.fileName = "renamed-by-allowChange.txt";
        let allowedFailed: string | null = null;
        try {
            await ExecutionMode.global(async () => { await flagged.save(); });
        } catch (e) { allowedFailed = (e as Error).message; }
        check("allowChange lets a saved file be changed", allowedFailed == null, allowedFailed ?? "");
        check("and the change reached the database",
            ((await ExecutionMode.global(() => retrieve(FileEntity, other.id!)) as FileEntity)).fileName
            === "renamed-by-allowChange.txt");

        // `allowChanges()` is the SCOPED form (Signum's IDisposable): it restores the previous value, so
        // the file is immutable again on the way out.
        const scoped = await ExecutionMode.global(() => retrieve(FileEntity, other.id!)) as FileEntity;
        {
            using _ = scoped.allowChanges();
            check("allowChanges() sets the flag", scoped.allowChange);
            scoped.binaryFile = new Uint8Array([7, 7]);
            await ExecutionMode.global(async () => { await scoped.save(); });
        }
        check("allowChanges() restores the flag on exit", !scoped.allowChange);
        check("the hash followed the bytes written inside the scope",
            scoped.hash === md5(new Uint8Array([7, 7])), String(scoped.hash));

        // ...and the guard is back: the same instance, outside the scope, is refused again.
        scoped.fileName = "should-not-land.txt";
        let refusedAgain = false;
        try {
            await ExecutionMode.global(async () => { await scoped.save(); });
        } catch { refusedAgain = true; }
        check("outside the scope the file is immutable again", refusedAgain);
    } finally {
        await ExecutionMode.global(async () => {
            const rows = await table(FileEntity).toArray() as FileEntity[];
            await deleteList(rows.filter(r => created.some(c => c.id === r.id)));
        });
    }

    console.log(`\n[fileentity] ${pass} checks passed`);
    for (const f of failures)
        console.log("  FAILED " + f);

    await Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
