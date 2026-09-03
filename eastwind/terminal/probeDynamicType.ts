// The end-to-end test of the COMPILED half of Signum.Dynamic: define a type from data, and use it.
//
// This is the whole feature in one script, in the order a real user meets it:
//   1. create a DynamicType row (a name, a base, some properties, a Save operation, a toString);
//   2. RESTART — the schema is built once, so a type takes part only on the next boot. Here that is a
//      second Starter.start in a fresh process (the script is run twice, `--phase`);
//   3. the generated source is written, compiled with the quote-transformer, loaded, and its `XLogic.start`
//      INCLUDES it, so the schema has a table for it;
//   4. `terminal sync` creates that table (the real command — this script does not reimplement it);
//   5. save a row through the generated type, query it back, and read its display string.
//
// Run: node … dist/terminal/probeDynamicType.js define
//      node … dist/terminal/terminal.js sync
//      node … dist/terminal/probeDynamicType.js use
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { Operations } from "@altea/altea/server/operationLogic";
import { UserHolder } from "@altea/altea/server/userHolder";
import { UserWithClaims } from "@altea/altea/data/security";
import { resolveType, getTypeInfo } from "@altea/altea/data/reflection";
import type { Entity } from "@altea/altea/data/entity";
import { Schema } from "@altea/altea/server/schema/schema";
import { DynamicTypeEntity, DynamicTypeOperation, DynamicBaseType } from "@altea/altea-dynamic/data/DynamicType";
import { DynamicLogic } from "@altea/altea-dynamic/server/DynamicLogic.server";
import { UserEntity } from "@altea/altea-auth/data/User";

const TYPE_NAME = "ProbeDynamic";

/** The definition — pure DATA, which is the point of the feature. */
function definition(): string {
    return JSON.stringify({
        entityKind: "Main",
        entityData: "Transactional",
        properties: [
            {
                uid: "1", name: "Code", type: "string",
                isNullable: "No", uniqueIndex: "Yes",
                validators: [{ type: "StringLength", min: 2, max: 20 }],
            },
            {
                uid: "2", name: "Quantity", type: "int",
                isNullable: "No", uniqueIndex: "No",
            },
            {
                uid: "3", name: "Comment", type: "string",
                isNullable: "Yes", uniqueIndex: "No",
                validators: [{ type: "StringLength", max: 100, multiLine: true }],
            },
        ],
        operationSave: { execute: "" },
        operationDelete: { delete: "" },
        queryFields: ["Code", "Quantity"],
        toStringExpression: "this.Code",
    }, undefined, 2);
}

async function asSystem<T>(fn: () => Promise<T>): Promise<T> {
    const system = (await table(UserEntity).filter(u => u.userName == "System").toArray())[0] as UserEntity;
    return await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), fn);
}

async function define(): Promise<void> {
    await asSystem(async () => {
        const existing = (await table(DynamicTypeEntity)
            .filter(dt => dt.typeName == TYPE_NAME).toArray() as DynamicTypeEntity[])[0];

        const dt = existing ?? DynamicTypeEntity.create({
            typeName: TYPE_NAME,
            baseType: DynamicBaseType.Entity,
        });
        dt.typeDefinition = definition();

        await Operations.execute(dt, DynamicTypeOperation.Save);
        console.log(`[define] DynamicType '${TYPE_NAME}' saved (id ${dt.id})`);
    });

    console.log("[define] now RESTART: run this script again with `sync`, then `use`.");
}

function reportCompilation(): boolean {
    if (DynamicLogic.codeGenError != null) {
        console.log("[compile] FAILED:\n" + DynamicLogic.codeGenError.message);
        return false;
    }

    const written = DynamicLogic.lastCompilation?.written ?? [];
    console.log(`[compile] ${written.length} generated module(s): ${written.join(", ")}`);

    const ctor = resolveType(TYPE_NAME + "Entity");
    if (ctor == null) {
        console.log(`[compile] '${TYPE_NAME}Entity' did NOT reach the reflection registry`);
        return false;
    }

    const ti = getTypeInfo(ctor as never);
    console.log(`[compile] ${TYPE_NAME}Entity fields: ${Object.keys(ti?.fields ?? {}).join(", ")}`);

    const t = Schema.current.tryTable(ctor as never);
    console.log(`[compile] its table: ${t == null ? "(NOT in the schema)" : t.name.toString()}`);
    return t != null;
}

async function use(): Promise<void> {
    if (!reportCompilation())
        return;

    const ctor = resolveType(TYPE_NAME + "Entity") as unknown as (new () => Entity) & { create(v: object): Entity };

    await asSystem(async () => {
        // Save a row through the generated type, using the generated Save operation.
        const symbols = await import(`file://${process.cwd().replace(/\\/g, "/")}/CodeGen/${TYPE_NAME}.js`)
            .then(m => (m as Record<string, unknown>)[`${TYPE_NAME}Operation`] as Record<string, unknown>);

        // Idempotent: the definition declared `uniqueIndex: Yes` on Code, and that constraint is REAL —
        // re-running without this fails with "duplicate key value violates unique constraint
        // uix_probe_dynamic_code", which is itself the proof that the definition reached the database.
        const existing = await table(ctor as never).toArray() as Entity[];
        for (const old of existing)
            await old.delete();

        const row = ctor.create({ Code: "ABC", Quantity: 7, Comment: "written through a generated type" });
        await Operations.execute(row, symbols["Save"] as never);
        console.log(`[use] saved id ${(row as Entity).id}, toString = "${row.toString()}"`);

        const back = await table(ctor as never).toArray() as Entity[];
        console.log(`[use] queried back ${back.length} row(s): `
            + back.map(r => `${r.id}:${r.toString()}`).join(", "));

        // The @quoted toString must also work INSIDE a query — the transformer's expression tree.
        const codes = await table(ctor as never).map(e => e.toString()).toArray();
        console.log(`[use] toString() lowered to SQL: ${JSON.stringify(codes)}`);
    });
}

async function main(): Promise<void> {
    const phase = process.argv[2] ?? "use";
    await Starter.start(process.env["EASTWIND_DB"]!);

    if (phase === "define") await define();
    else await use();

    await Connector.current().closeConnection();
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
