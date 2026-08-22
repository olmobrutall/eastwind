import path from "node:path";
import url from "node:url";
import type { SchemaBuilder } from "@altea/altea/server/schema";
import { EvalLogic } from "@altea/altea-eval/server/EvalLogic.server";
import * as basics from "@altea/altea/data/basics";
import * as lite from "@altea/altea/data/lite";
import * as entity from "@altea/altea/data/entity";
import * as validators from "@altea/altea/data/validators";
import * as tableModule from "@altea/altea/server/table";
import * as database from "@altea/altea/server/Database";
import * as operationLogic from "@altea/altea/server/operationLogic";
import * as userHolder from "@altea/altea/server/userHolder";
import * as user from "@altea/altea-auth/data/User";
import * as role from "@altea/altea-auth/data/Role";
import * as authLogic from "@altea/altea-auth/server/AuthLogic";
import * as workflowEval from "@altea/altea-workflow/data/WorkflowEval";
import * as workflowCase from "@altea/altea-workflow/data/Case";
import * as caseActivity from "@altea/altea-workflow/data/CaseActivity";
import * as order from "./orders/Order.data";
import * as customer from "./customers/Customer.data";
import * as employee from "./employees/Employee.data";
import * as product from "./products/Product.data";
import * as shipper from "./shippers/Shipper.data";

// eastwind's side of @altea/altea-eval — WHAT a stored script may reach.
//
// Signum's counterpart is the `EvalLogic.AddFullAssembly(...)` / `EvalLogic.Namespaces.Add(...)` block an app
// writes in its Starter (Southwind's is in `Starter.cs`), plus the `GetUsingNamespaces()` list that decides
// what every generated eval gets for free. altea's registry is single-sided (see EvalCompiler's header): the
// same entry is what the TYPE CHECK resolves and what the runtime `require` answers with, so a script can only
// import a module the app imported here first.
//
// Worth knowing:
//  - a module is registered by its own import SPECIFIER, so a script's import line reads exactly like one in
//    the rest of the codebase (`import { table } from "@altea/altea/server/table"`).
//  - eastwind's OWN modules need `typesPath`: TypeScript resolves `@altea/*` through their package exports,
//    but nothing depends on `eastwind`, so there is no node_modules entry for it to follow. The path points at
//    the BUILT `.d.ts`, which is what the server is running from anyway.
//  - `typeNames` declares a name that exists only as a TYPE (an interface has no runtime property to find).
//  - a compiled script runs in process with the server's rights, exactly as Signum's Roslyn-compiled C# does.

export namespace EastwindEval {

    /** The eastwind package directory (this module lives in `dist/`, so one level up). */
    const packageDirectory = path.resolve(url.fileURLToPath(new URL(".", import.meta.url)), "..");

    /** The built type declarations for eastwind's own modules — see the header. */
    function types(relative: string): string {
        return path.join(packageDirectory, "dist", relative).split(path.sep).join("/");
    }

    export function start(sb: SchemaBuilder): void {
        // `baseDirectory` is where a generated eval pretends to live, so `@altea/*` resolves through
        // eastwind's node_modules.
        EvalLogic.start(sb, { baseDirectory: packageDirectory });

        // ---- The framework -------------------------------------------------------------------------------
        EvalLogic.registerModules({
            "@altea/altea/data/basics": basics,               // Decimal, Temporal, toInt, int
            "@altea/altea/data/lite": lite,
            "@altea/altea/data/entity": entity,
            "@altea/altea/data/validators": validators,
            "@altea/altea/server/table": tableModule,         // table(X) — the query entry point
            "@altea/altea/server/Database": database,
            "@altea/altea/server/operationLogic": operationLogic, // Operations.execute / construct
            "@altea/altea/server/userHolder": userHolder,
        });

        // ---- Authorization -------------------------------------------------------------------------------
        EvalLogic.registerModules({
            "@altea/altea-auth/data/User": user,
            "@altea/altea-auth/data/Role": role,
            "@altea/altea-auth/server/AuthLogic": authLogic,
        });

        // ---- Workflow: the two context objects an eval is handed, and the case types -------------------
        EvalLogic.registerModule("@altea/altea-workflow/data/WorkflowEval", workflowEval);
        EvalLogic.registerModule("@altea/altea-workflow/data/Case", workflowCase,
            { typeNames: ["ICaseMainEntity"] });
        EvalLogic.registerModule("@altea/altea-workflow/data/CaseActivity", caseActivity);

        // ---- The app's own entity domains ----------------------------------------------------------------
        EvalLogic.registerModule("./orders/Order.data", order, { typesPath: types("orders/Order.data.d.ts") });
        EvalLogic.registerModule("./customers/Customer.data", customer,
            { typesPath: types("customers/Customer.data.d.ts") });
        EvalLogic.registerModule("./employees/Employee.data", employee,
            { typesPath: types("employees/Employee.data.d.ts") });
        EvalLogic.registerModule("./products/Product.data", product,
            { typesPath: types("products/Product.data.d.ts") });
        EvalLogic.registerModule("./shippers/Shipper.data", shipper,
            { typesPath: types("shippers/Shipper.data.d.ts") });

        // Signum's `GetUsingNamespaces()`: what every eval gets without importing it. Kept small on purpose —
        // these four cover almost every script (a decimal comparison, a query, an operation, a date).
        EvalLogic.addPreamble(
            `import { Decimal, Temporal, toInt } from "@altea/altea/data/basics";`,
            `import { table } from "@altea/altea/server/table";`,
            `import { Operations } from "@altea/altea/server/operationLogic";`,
            `import { UserHolder } from "@altea/altea/server/userHolder";`,
        );
    }
}
