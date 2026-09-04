// DynamicIsolation: mark a dynamically defined type as ISOLATED, and check it really becomes one.
//
// The chain under test is three links long and every one is generated or declared at startup:
//   1. the DynamicIsolationMixin on DynamicTypeEntity carries the strategy (eastwind declares the mixin —
//      see entityOverrides — without ever starting @altea/altea-isolation);
//   2. DynamicIsolationLogic generates `CodeGenIsolationLogic.ts`, one `Isolation.register(X, "Isolated")`
//      per type that asks for one;
//   3. that call declares the ISOLATION MIXIN on the generated type, whose `isolation` field is a real
//      column — which is why it has to run before the schema is built, and why a `sync` follows.
//
// Run: node … dist/terminal/probeDynamicIsolation.js define
//      node … dist/terminal/probeDynamicIsolation.js use
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { Operations } from "@altea/altea/server/operationLogic";
import { UserHolder } from "@altea/altea/server/userHolder";
import { UserWithClaims } from "@altea/altea/data/security";
import { resolveType, getTypeInfo } from "@altea/altea/data/reflection";
import { MixinDeclarations } from "@altea/altea/data/mixinDeclarations";
import { Schema } from "@altea/altea/server/schema/schema";
import { DynamicTypeEntity, DynamicTypeOperation } from "@altea/altea-dynamic/data/DynamicType";
import { DynamicIsolationMixin } from "@altea/altea-dynamic/data/DynamicIsolation";
import { DynamicLogic } from "@altea/altea-dynamic/server/DynamicLogic";
import { IsolationMixin } from "@altea/altea-isolation/data/Isolation";
import { Isolation } from "@altea/altea-isolation/data/Isolation";
import { UserEntity } from "@altea/altea-auth/data/User";

const TYPE_NAME = "ProbeDynamic";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

async function asSystem<T>(fn: () => Promise<T>): Promise<T> {
    const system = (await table(UserEntity).filter(u => u.userName == "System").toArray())[0] as UserEntity;
    return await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), fn);
}

async function define(): Promise<void> {
    await asSystem(async () => {
        const dt = (await table(DynamicTypeEntity)
            .filter(d => d.typeName == TYPE_NAME).toArray() as DynamicTypeEntity[])[0];

        if (dt == null)
            throw new Error(`no DynamicType '${TYPE_NAME}' — run probeDynamicType define first`);

        // The mixin's field, reached through the MIXIN STEP even though its column is flattened onto
        // dynamic_type (the accommodation @altea/altea-diff-log documents).
        dt.mixin(DynamicIsolationMixin).isolationStrategy = "Isolated";
        await Operations.execute(dt, DynamicTypeOperation.Save);

        console.log(`[define] '${TYPE_NAME}' isolationStrategy = Isolated (id ${dt.id})`);
    });

    console.log("[define] now RESTART: `terminal sync --apply`, then `use`.");
}

async function use(): Promise<void> {
    if (DynamicLogic.codeGenError != null) {
        console.log("[compile] FAILED:\n" + DynamicLogic.codeGenError.message);
        process.exitCode = 1;
        return;
    }

    const written = DynamicLogic.lastCompilation?.written ?? [];
    console.log(`[compile] ${written.length} generated module(s): ${written.join(", ")}`);
    check("the isolation module was generated", written.includes("CodeGenIsolationLogic.ts"),
        written.join(", "));

    const ctor = resolveType(TYPE_NAME + "Entity");
    check("the dynamic type loaded", ctor != null);
    if (ctor == null)
        return;

    // 1. the strategy reached altea-isolation's registry.
    check("altea-isolation knows the strategy",
        Isolation.strategy(ctor as never) === "Isolated",
        String(Isolation.tryStrategy?.(ctor as never) ?? "(none)"));

    // 2. the ISOLATION MIXIN is declared on it — which is what `Isolation.register` does, and what makes
    //    the type isolated rather than merely labelled.
    const mixins = MixinDeclarations.getMixins(ctor as never).map(m => m.name);
    check("the IsolationMixin is declared on the generated type",
        mixins.includes(IsolationMixin.name), mixins.join(", "));

    // 3. the field is real reflection — on the MIXIN's own TypeInfo, not the owner's.
    //
    //    This is the accommodation altea makes everywhere for mixins and it is worth stating: the COLUMN
    //    is flattened onto the owner's table (checked below), but the FIELD belongs to the mixin, so a
    //    route to it carries the mixin STEP (`subCtx(a => a.mixin(IsolationMixin))`, as
    //    @altea/altea-diff-log documents). Asking the owner's TypeInfo for an `isolation` field is
    //    therefore the wrong question — it is not there, and should not be.
    const mixinTi = getTypeInfo(IsolationMixin as never);
    check("the mixin declares the `isolation` field", mixinTi?.fields?.["isolation"] != null,
        Object.keys(mixinTi?.fields ?? {}).join(", "));

    const ownerTi = getTypeInfo(ctor as never);
    check("and the OWNER's own fields do not (the column is flattened, the field is not)",
        ownerTi?.fields?.["isolation"] == null,
        Object.keys(ownerTi?.fields ?? {}).join(", "));

    // 4. and it is a COLUMN on the type's own table — the end of the chain.
    const t = Schema.current.tryTable(ctor as never);
    const columns = t == null ? [] : Object.keys(t.columns);
    check("it is a column on the type's table",
        columns.some(c => c.toLowerCase().includes("isolation")),
        columns.join(", "));

    console.log(`\n[isolation] ${pass} checks passed`);
    for (const f of failures)
        console.log("  FAILED " + f);
    process.exitCode = failures.length === 0 ? 0 : 1;
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    if ((process.argv[2] ?? "use") === "define") await define();
    else await use();

    await Connector.current().closeConnection();
}

main().catch(e => { console.error(e); process.exit(1); });
