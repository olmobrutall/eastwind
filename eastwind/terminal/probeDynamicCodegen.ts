// Does altea's runtime CODEGEN pipeline work? Generate TypeScript for an entity, compile it with the
// quote-transformer applied, load it, and check that what comes out is indistinguishable from a declared
// type — reflection, a stamped `@quoted` toString, and a PropertyRoute.
//
// This is the load-bearing experiment for the compiled half of Signum.Dynamic. Signum writes C# into
// CodeGen and compiles it with Roslyn; the altea counterpart has to put the quote-transformer in the emit
// pipeline, because that transformer is what synthesises `@field` from a type annotation and what turns a
// `@quoted` lambda into the expression tree the LINQ provider reads. A generated module that skipped it
// would compile and then be invisible to reflection.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeDynamicCodegen.js
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { DynamicCodeCompiler } from "@altea/altea-dynamic/server/DynamicCodeCompiler";
import { resolveType, getTypeInfo } from "@altea/altea/data/reflection";
import { PropertyRoute } from "@altea/altea/data/propertyRoute";
import { Entity } from "@altea/altea/data/entity";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

// The app's own directory, so node_modules and the transformer's `__fileInfo` resolve from it.
const appDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const codeGen = path.join(appDirectory, "CodeGen");

DynamicCodeCompiler.configure({ codeGenDirectory: codeGen });

// What DynamicTypeLogic will generate — written out here by hand so the pipeline is what is under test.
// Deliberately includes the two things only the transformer can do: a bare field whose type comes from the
// annotation, and a `@quoted toString()`.
const source = `import { Entity } from "@altea/altea/data/entity";
import { entity, quoted } from "@altea/altea/data/decorators";
import { stringLengthValidator } from "@altea/altea/data/validators";
import { reflect } from "@altea/altea/data/reflection";
import { type int } from "@altea/altea/data/basics";

@reflect
@entity("Main", "Transactional")
export class ProbeCodeGenEntity extends Entity {

    @stringLengthValidator({ max: 20 })
    code: string;

    quantity: int;

    comment: string | null;

    @quoted toString(): string { return this.code; }
}
`;

console.log(`[codegen] compiling into ${codeGen}`);
const result = await DynamicCodeCompiler.compileAndLoad([{ fileName: "ProbeCodeGenEntity.ts", content: source }]);

check("it compiled with no errors", result.errors.length === 0,
    result.errors.map(e => `${e.fileName}:${e.line} ${e.message}`).join(" | "));
check("it wrote the generated source", result.written.includes("ProbeCodeGenEntity.ts"));

if (result.errors.length === 0) {
    // 1. the emitted JS must carry what the TRANSFORMER adds — the proof it actually ran.
    const js = fs.readFileSync(path.join(codeGen, "ProbeCodeGenEntity.js"), "utf8");
    check("the transformer stamped __fileInfo", js.includes("__fileInfo"));
    check("the transformer synthesised @field from the annotations",
        js.includes('field({ typeName: "String"') || js.includes('typeName: "String"'), "");
    check("the transformer appended registerType",
        js.includes('registerType(ProbeCodeGenEntity, "ProbeCodeGenEntity"'));

    // 2. the loaded type must be a first-class altea type.
    const Built = resolveType("ProbeCodeGenEntity");
    check("it resolves by clean name", Built != null);

    const ti = Built == null ? undefined : getTypeInfo(Built as never);
    check("it has reflection", ti != null);
    check("its fields came from the annotations",
        ["code", "quantity", "comment"].every(n => ti?.fields?.[n] != null),
        Object.keys(ti?.fields ?? {}).join(", "));
    check("an int field kept its subTypeName", ti?.fields?.["quantity"]?.subTypeName === "int",
        String(ti?.fields?.["quantity"]?.subTypeName));
    check("a nullable field is nullable", ti?.fields?.["comment"]?.isNullable === true,
        String(ti?.fields?.["comment"]?.isNullable));

    if (Built != null) {
        try {
            const pr = PropertyRoute.root(Built as never).add("code");
            check("PropertyRoute walks it", pr.propertyString() === "code", pr.propertyString());
        } catch (e) {
            check("PropertyRoute walks it", false, String((e as Error).message));
        }

        const inst = new (Built as new () => Entity)() as Entity & Record<string, unknown>;
        inst["code"] = "ABC";
        check("an instance is an Entity", inst instanceof Entity);
        check("its toString() runs", inst.toString() === "ABC", inst.toString());

        // 3. the `@quoted` tree — what makes the toString usable INSIDE a query, i.e. what lets a search
        //    show this type's display string as a column. It is stamped by the transformer from the
        //    `@quoted` decorator (a plain toString() carries none, declared types included), so this is
        //    the check that the transformer's most substantial rewrite reached generated code.
        const quoted = Built.prototype.toString.__quoted;
        check("its toString() carries a __quoted tree", quoted != null);
    }
}

// A compile ERROR must come back as data, not as a throw — the panel shows it on the row.
const bad = await DynamicCodeCompiler.compileAndLoad([{
    fileName: "ProbeCodeGenBroken.ts",
    content: `export class Broken { x: number = "not a number"; }\n`,
}]);
check("a broken module reports a diagnostic instead of throwing", bad.errors.length > 0,
    String(bad.errors.length));
check("the diagnostic names the file and line",
    bad.errors[0]?.fileName === "ProbeCodeGenBroken.ts" && bad.errors[0]?.line > 0,
    JSON.stringify(bad.errors[0] ?? null));

console.log(`\n[codegen] ${pass} checks passed`);
for (const f of failures)
    console.log("  FAILED " + f);
process.exit(failures.length === 0 ? 0 : 1);
