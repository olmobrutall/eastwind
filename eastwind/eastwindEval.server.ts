import path from "node:path";
import url from "node:url";
import type { SchemaBuilder } from "@altea/altea/server/schema";
import { EvalLogic } from "@altea/altea-eval/server/EvalLogic.server";
import * as user from "@altea/altea-auth/data/User";
import * as role from "@altea/altea-auth/data/Role";
import * as authLogic from "@altea/altea-auth/server/AuthLogic";
import * as order from "./orders/Order.data";
import * as customer from "./customers/Customer.data";
import * as employee from "./employees/Employee.data";
import * as product from "./products/Product.data";
import * as shipper from "./shippers/Shipper.data";

// eastwind's side of @altea/altea-eval — WHAT a stored script may reach, beyond what the modules already
// register themselves.
//
// Signum's counterpart is the `EvalLogic.AddFullAssembly(...)` block an app MAY write in its Starter —
// Southwind writes none, because Signum's EvalLogic seeds the FRAMEWORK's own assemblies itself. altea now
// does the same: @altea/altea's modules are seeded by altea-eval (EvalFrameworkModules) and altea-workflow
// registers its three from its own start, so what is left here is what only THIS application can know:
//
//  - its own entity domains, which need `typesPath`: TypeScript resolves `@altea/*` through their package
//    exports, but nothing depends on `eastwind`, so there is no node_modules entry to follow. The path points
//    at the BUILT `.d.ts`, which is what the server runs from anyway.
//  - the AUTH modules: altea-auth does not depend on altea-eval (a framework package must not depend on an
//    optional one), so it cannot register itself — the app opts them in.
//
// A compiled script runs in process with the server's rights, exactly as Signum's Roslyn-compiled C# does.

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

        // ---- Authorization (see the header: altea-auth cannot register itself) ---------------------------
        EvalLogic.registerModules({
            "@altea/altea-auth/data/User": user,
            "@altea/altea-auth/data/Role": role,
            "@altea/altea-auth/server/AuthLogic": authLogic,
        });

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

    }
}
