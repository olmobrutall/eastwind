import { describe, test, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { EvalCompiler } from "@altea/altea-eval/server/EvalCompiler";
import { EvalLogic } from "@altea/altea-eval/server/EvalLogic";
import { hasDb, startEngine } from "../environment/testDatabase";

// What the EDITOR is served: the identifier map it runs the implicit-import pass over, and the `.d.ts`
// closure it checks against. The browser half is exercised by hand; what is pinned here is the SIZE and the
// SHAPE of what crosses the wire, because both are easy to break without noticing.
describe.skipIf(!hasDb)("EvalIntelliSense", () => {
    beforeAll(async () => { await startEngine(); });

    function eagerSpecifiers(): string[] {
        return EvalLogic.imports().modules.filter(m => m.eager).map(m => m.specifier);
    }

    // Shipping the eager closure to the browser is only reasonable while it stays small. It does not stay
    // small by itself: `@types/node` alone is 2.3 MB and arrives unasked, because altea's own server
    // declarations mention `Buffer` in passing — which is why `declarationsFor` drops the ambient `@types/*`
    // plumbing a script could never reach anyway. A dependency that re-introduces it would quintuple the
    // payload silently, so the budget is asserted rather than assumed.
    test("the eager closure stays small enough to ship", () => {
        const files = EvalCompiler.declarationsFor(EvalLogic.imports(), eagerSpecifiers());

        const bytes = files.reduce((n, f) => n + f.content.length, 0);
        assert.ok(files.length > 50, `expected a real closure, got ${files.length} files`);
        assert.ok(bytes < 1_000_000, `the eager closure is ${(bytes / 1024 / 1024).toFixed(2)} MB`);

        assert.equal(files.filter(f => /\/node_modules\/(@types|undici-types)\//.test(f.path)).length, 0,
            "ambient @types plumbing should not be shipped");
    });

    // The layout is what makes the editor's own resolver find these without being configured: classic node
    // resolution looks for `node_modules/<package>/<subpath>`, and an app's own module is addressed by
    // relative path from the script. Both are asserted, because a wrong prefix fails silently — the editor
    // simply never resolves anything and underlines the whole script.
    test("declarations are laid out where the editor's resolver looks", () => {
        const files = EvalCompiler.declarationsFor(EvalLogic.imports(), 
            ["@altea/altea/data/basics", "./app/orders/Order.data"]);
        const paths = files.map(f => f.path);

        assert.ok(paths.includes(`${EvalCompiler.CLIENT_ROOT}/node_modules/@altea/altea/data/basics.d.ts`),
            "a package module keeps its specifier under node_modules, with `dist/` removed");
        assert.ok(paths.includes(`${EvalCompiler.CLIENT_ROOT}/app/orders/Order.data.d.ts`),
            "an app module sits beside the script, so `./app/orders/Order.data` resolves");
    });

    // `have` is the whole reason a second module is cheap: the closures overlap almost entirely (every
    // entity declaration imports the framework's), so without it each lazy fetch would re-send the eager
    // half.
    test("a lazy module costs only what it adds", () => {
        const eager = EvalCompiler.declarationsFor(EvalLogic.imports(), eagerSpecifiers());
        const have = new Set(eager.map(f => f.path));

        const whole = EvalCompiler.declarationsFor(EvalLogic.imports(), ["./app/orders/Order.data"]);
        const delta = EvalCompiler.declarationsFor(EvalLogic.imports(), ["./app/orders/Order.data"], have);

        assert.ok(delta.length < whole.length,
            `expected the delta (${delta.length}) to be smaller than the whole (${whole.length})`);
        assert.equal(delta.filter(f => have.has(f.path)).length, 0);
    });

    // The editor resolves a bare `OrderEntity` by looking it up in this map and writing the same import the
    // compiler would. If the map were empty — or keyed differently — the editor would quietly stop resolving
    // anything the application declares, which looks like "IntelliSense is broken" rather than like a bug.
    test("the identifier map covers what a script would name", () => {
        const configuration = EvalCompiler.clientConfiguration(EvalLogic.imports());
        const names = new Map(configuration.names);

        assert.equal(names.get("OrderEntity"), "./app/orders/Order.data");
        assert.equal(names.get("WorkflowTransitionContext"), "@altea/altea-workflow/data/WorkflowEval");
        assert.ok(configuration.eagerLines.some(l => l.includes(`from "@altea/altea/server/table"`)),
            "`table` is eager, so no script has to import it");

        // An entity an ALTEA MODULE declares, not the application. A script names the entity it is written
        // for, and `fromSchema` used to be narrowed to the app's own package — so an email template for
        // ResetPasswordRequest could not name ResetPasswordRequestEntity, and the server reported "cannot
        // find name" in a wrapper it had generated itself.
        assert.equal(names.get("ResetPasswordRequestEntity"),
            "@altea/altea-auth-reset-password/data/ResetPassword");
    });

    // The end of that story: the wrapper such a template really generates has to compile.
    test("a template for an altea module's entity compiles", async () => {
        const header = ["", "export default function evaluate(e: ResetPasswordRequestEntity | null): boolean {"];
        const code = [...header, "return e != null;", "}", ""].join("\n");

        const result = await EvalCompiler.compiler.compile(code, header.length, EvalLogic.imports());

        assert.equal(result.compilationErrors, undefined, result.compilationErrors);
    });
});
