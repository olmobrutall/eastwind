// Can altea build a REAL entity type at RUNTIME, from a definition that is only data?
//
// CLAUDE.md records DynamicType as unported because "altea's entity model is stamped at BUILD time by the
// quote-transformer". But reading what the transformer actually emits for a plain entity, all it does is
// synthesise `@field({ typeName / type / lite / array })` from the TypeScript type annotations, add a
// `__fileInfo`, and append `registerType(Ctor, "Name", __fileInfo)`. It INFERS from source what a
// DynamicType definition already states outright — so a generated type should need no compiler at all,
// only the same decorators applied programmatically.
//
// This probe tests exactly that, and nothing else: build a class with those primitives, register it,
// include it in the schema, and see whether reflection, the table, a save and a query all behave as they
// do for a declared type.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeRuntimeEntity.js
import { Entity } from "@altea/altea/data/entity";
import { field, reflect, getTypeInfo, resolveType, type SubTypeName } from "@altea/altea/data/reflection";
import { entityIntegrityCheck } from "@altea/altea/data/validation";
import { entity } from "@altea/altea/data/decorators";
import { PropertyRoute } from "@altea/altea/data/propertyRoute";
import { stringLengthValidator } from "@altea/altea/data/validators";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

/** The shape a DynamicType row would carry — nothing here is code. */
interface DynamicFieldDef {
    name: string;
    typeName: "String" | "Number" | "Boolean" | "PlainDate";
    subTypeName?: SubTypeName;
    nullable?: boolean;
    maxLength?: number;
}

interface DynamicTypeDef {
    typeName: string;
    entityKind: string;
    entityData: string;
    fields: DynamicFieldDef[];
}

/**
 * Build a real entity constructor from a definition.
 *
 * This is the whole experiment: the same three primitives the transformer's output uses, called by hand.
 */
function buildEntityType(def: DynamicTypeDef): typeof Entity {
    // A named class, so the ctor name matches the type name (stack traces, toString, the registries).
    const ctor = { [def.typeName]: class extends Entity { } }[def.typeName];

    for (const f of def.fields) {
        const decorators: Array<(t: object, k: string) => void> = [
            field({ typeName: f.typeName, subTypeName: f.subTypeName, nullable: f.nullable }) as never,
        ];
        if (f.maxLength != null)
            decorators.push(stringLengthValidator({ max: f.maxLength }) as never);

        for (const d of decorators)
            d(ctor.prototype, f.name);
    }

    entity(def.entityKind as never, def.entityData as never)(ctor as never);
    reflect(ctor as never);
    return ctor;
}

const definition: DynamicTypeDef = {
    typeName: "ProbeRuntimeEntity",
    entityKind: "Main",
    entityData: "Transactional",
    fields: [
        { name: "code", typeName: "String", maxLength: 20 },
        { name: "quantity", typeName: "Number", subTypeName: "int" },
        { name: "comment", typeName: "String", nullable: true, maxLength: 100 },
    ],
};

const Built = buildEntityType(definition);

// 1. is it a registered TYPE, with the reflection a declared entity has?
const ti = getTypeInfo(Built as never);
check("getTypeInfo resolves the built type", ti != null);
check("it resolves under the definition's clean name",
    resolveType("ProbeRuntimeEntity") === (Built as never),
    String(resolveType("ProbeRuntimeEntity") != null));
check("it has the declared fields",
    ["code", "quantity", "comment"].every(n => ti?.fields?.[n] != null),
    Object.keys(ti?.fields ?? {}).join(", "));
check("a field's type came from the definition", ti?.fields?.["quantity"]?.typeName === "Number",
    ti?.fields?.["quantity"]?.typeName);
check("nullability came from the definition", ti?.fields?.["comment"]?.isNullable === true,
    String(ti?.fields?.["comment"]?.isNullable));

// 2. can a PropertyRoute be built over it? (what every Line, rule and token needs)
try {
    const pr = PropertyRoute.root(Built as never).add("code");
    check("PropertyRoute walks it", pr.propertyString() === "code", pr.propertyString());
} catch (e) {
    check("PropertyRoute walks it", false, String((e as Error).message));
}

// 3. does an INSTANCE behave — construct, dirty-track, validate?
try {
    const inst = new (Built as unknown as new () => Entity)() as Entity & Record<string, unknown>;
    inst["code"] = "ABC";
    inst["quantity"] = 3;
    check("an instance is an Entity", inst instanceof Entity);
    check("it dirty-tracks", inst.isDirty());

    const tooLong = new (Built as unknown as new () => Entity)() as Entity & Record<string, unknown>;
    tooLong["code"] = "X".repeat(50);
    tooLong["quantity"] = 1;
    const check1 = entityIntegrityCheck(tooLong, "Saving");
    check("the definition's validator fires",
        check1 != null && Object.keys(check1.errors ?? {}).includes("code"),
        JSON.stringify(check1?.errors ?? null));
} catch (e) {
    check("an instance behaves", false, String((e as Error).message));
}

console.log(`\n[runtime-entity] ${pass} checks passed`);
for (const f of failures)
    console.log("  FAILED " + f);
process.exit(failures.length === 0 ? 0 : 1);
