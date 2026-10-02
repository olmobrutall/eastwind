import { describe, test, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { table } from "@altea/altea/server/table";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { EvalCompiler } from "@altea/altea-eval/server/EvalCompiler";
import { hoistImports } from "@altea/altea-eval/data/Eval";
import { EvalLogic } from "@altea/altea-eval/server/EvalLogic";
import { OrderEntity, OrderState } from "../../app/orders/Order.data";
import { WorkflowConditionEntity, WorkflowConditionEval } from "@altea/altea-workflow/data/WorkflowCondition";
import { TypeLogic } from "@altea/altea/server/typeLogic";
import { Connector } from "@altea/altea/server/connection/connector";
import { exploreModifiables, fullIntegrityCheckAsync } from "@altea/altea/server/graphExplorer";
import { bindParentsOwn } from "@altea/altea/data/parentEntity";
import { Entity } from "@altea/altea/data/entity";
import { hasDb, startEngine } from "../environment/testDatabase";

// What a stored script may reach, and what happens to it on the way to the database.
//
// Nothing is registered here: `Starter.start` has already run eastwind's own `EvalLogic.start`, so these
// exercise the application's real configuration rather than a fixture of one.
describe.skipIf(!hasDb)("Eval", () => {
    beforeAll(async () => { await startEngine(); });

    /**
     * What `EvalEmbedded.wrap` builds: a signature and the script, with the author's own leading imports
     * lifted above the signature. The same `hoistImports` the real wrapper uses, so these exercise the
     * production path rather than a lookalike.
     */
    function compile<F>(parameters: string, returnType: string, script: string):
        Promise<{ algorithm?: F; compilationErrors?: string }> {

        const { imports, at, body } = hoistImports(script);
        const header = [
            ...imports,
            "",
            `export default async function evaluate(${parameters}): Promise<Awaited<${returnType}>> {`,
        ];
        const code = [...header, body, "}", ""].join("\n");
        return EvalCompiler.compiler.compile<F>(code, header.length, EvalLogic.imports(), at);
    }

    // A lambda written in a STORED script has to reach the database as SQL, exactly like one written in a
    // source file. That only works because the eval compiler emits through its `ts.Program` with the quote
    // transformer attached: the transformer is type-driven, so `ts.transpileModule` — which has no checker
    // — left every stored lambda unstamped, and a query built from one could never lower.
    //
    // The assertion is deliberately a COMPARISON against the same query written here: if the stored script
    // silently fell back to in-memory evaluation, or stopped being quoted at all, the two counts part
    // company (or the script throws outright, which is what an unstamped lambda does).
    test("a lambda in a stored script lowers to SQL", async () => {
        // NOTHING is imported. `OrderEntity` and `OrderState` are reached through `fromSchema`, and `table`
        // is eager — so this is what an author would actually type.
        const result = await compile<(s: OrderState) => Promise<number>>(
            "state: OrderState", "number",
            "return await table(OrderEntity).filter(o => o.state == state).count();");

        assert.equal(result.compilationErrors, undefined, result.compilationErrors);

        await Transaction.noCommit(async () => {
            const expected = await table(OrderEntity).filter(o => o.state == OrderState.Shipped).count();
            assert.ok(expected > 0, "the fixture should have shipped orders");

            assert.equal(await result.algorithm!(OrderState.Shipped), expected);
        });
    });

    // An entity NAMED but never called is imported for its type alone, which the emit then elides — so the
    // module is never actually loaded. That is the whole point of the lazy half: the configuration
    // describes a module graph far larger than any one script needs.
    test("an entity used only as a type still resolves", async () => {
        const result = await compile<(e: OrderEntity) => Promise<string>>(
            "e: OrderEntity", "string", "return e.shipName ?? \"\";");

        assert.equal(result.compilationErrors, undefined, result.compilationErrors);
    });

    // The configuration, not the file system, decides what a script may reach. `node:fs` is the awkward
    // case: `@types/node` declares it AMBIENTLY somewhere in the .d.ts graph, so it never reaches module
    // resolution and refusing to resolve it would not have caught it — it type-checked clean and died at
    // run time. The specifiers are checked by name instead.
    test("a module outside the configuration is a compile error", async () => {
        for (const body of [
            "const x = await import(\"node:fs\"); return 1;",
            "const x = await import(\"@altea/altea/server/connection/transaction\"); return 1;",
        ]) {
            const result = await compile("", "number", body);
            assert.match(result.compilationErrors ?? "", /is not allowed in a script/, body);
        }
    });

    // The escape hatch. Everything else here relies on the configuration choosing a module for a name;
    // an author who needs to choose a different one writes the import themselves, and `wrap` lifts it above
    // the generated signature because TypeScript has no import inside a function.
    test("an import the author writes is hoisted, and wins", async () => {
        const result = await compile<(s: OrderState) => Promise<number>>(
            "state: OrderState", "number",
            `import { OrderEntity } from "./app/orders/Order.data";\n`
            + "return await table(OrderEntity).filter(o => o.state == state).count();");

        assert.equal(result.compilationErrors, undefined, result.compilationErrors);

        await Transaction.noCommit(async () => {
            const expected = await table(OrderEntity).filter(o => o.state == OrderState.Shipped).count();
            assert.equal(await result.algorithm!(OrderState.Shipped), expected);
        });
    });

    // A hoisted import moved ABOVE the script, so its diagnostics have to be mapped back down to the line
    // the author actually wrote it on — otherwise they are reported at a negative line number.
    test("an error in a hoisted import is reported at the author's line", async () => {
        const result = await compile(
            "", "number",
            `import { Transaction } from "@altea/altea/server/connection/transaction";\n`
            + "return 1;");

        assert.match(result.compilationErrors ?? "", /Line 1: .*is not allowed in a script/);
    });

    // The transformer's own errors have to arrive like any other compile error — at the line the AUTHOR
    // sees, not at the line of the generated wrapper — or an unquotable expression fails as a runtime
    // surprise instead of a save-time validation message. The line number is the real assertion: the
    // compiler writes import lines of its own above the script, and has to subtract them again.
    test("an unquotable lambda is a compile error on the author's line", async () => {
        const result = await compile(
            "state: OrderState", "number",
            "return await table(OrderEntity).filter(o => { return o.state == state; }).count();");

        assert.match(result.compilationErrors ?? "", /Line 1: .*quote/i);
    });

    // The whole point of the compiler being wired into the VALIDATOR: a script that does not build cannot
    // be saved. Compiling is now async, so this is also what proves the async validator path holds — a
    // promise returned from a field validator has to be awaited by the integrity check, not dropped.
    test("a stored script is validated on its way into the database", async () => {
        const typeEntity = (await TypeLogic.caches()).tryTypeToEntity(OrderEntity)!;

        async function errorsFor(script: string): Promise<string> {
            const condition = WorkflowConditionEntity.create({
                name: "eval-test-" + Math.random().toString(36).slice(2, 8),
                mainEntityType: typeEntity,
                eval: WorkflowConditionEval.create({ script }),
            });
            // What `saver` does before it checks anything: BINDING is what gives the eval its owner, and
            // so the main entity type its generated signature names.
            const all = exploreModifiables([condition]);
            for (const m of all)
                bindParentsOwn(m);
            for (const m of all)
                if (m instanceof Entity)
                    await Connector.current().schema.entityEvents(m.getType()).onPreSaving(m);

            const checks = await fullIntegrityCheckAsync(all, "Saving");
            return checks.flatMap(c => Object.values(c.errors)).join("\n");
        }

        // Import-free, and the implicit import has to pick OrderEntity out of `fromSchema` for both the
        // signature the wrapper generates and the body.
        assert.equal(await errorsFor("return e.shipName != null;"), "");

        // A typo is a VALIDATION error with the author's line, not a surprise when the workflow runs.
        assert.match(await errorsFor("return e.shipNme != null;"), /Line 1: .*shipNme/);
    });
});
