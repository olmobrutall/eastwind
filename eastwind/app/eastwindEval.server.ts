import path from "node:path";
import url from "node:url";
import type { SchemaBuilder } from "@altea/altea/server/schema";
import { EvalLogic } from "@altea/altea-eval/server/EvalLogic";
import * as authLogic from "@altea/altea-auth/server/AuthLogic";
import * as user from "@altea/altea-auth/data/User";
import * as role from "@altea/altea-auth/data/Role";

// eastwind's side of @altea/altea-eval — WHAT a stored script may reach, beyond what the modules already
// contribute themselves.
//
// The counterpart of the "add this assembly" block an app writes when its scripts need more than the
// framework's own surface. @altea/altea's modules are seeded by altea-eval (EvalFrameworkModules) and
// altea-workflow contributes its three from its own start, so what is left here is what only THIS
// application can know:
//
//  - its own entity domain, which is `fromSchema`: every registered entity and enum is importable by its
//    own name, and so is everything else declared beside it (its operations, its symbols). Nothing is
//    listed by hand, and a new entity is reachable from a script the day it is created.
//  - the AUTH modules: altea-auth does not depend on altea-eval (a framework package must not depend on an
//    optional one), so it cannot contribute itself — the app opts them in.
//
// ORDER IS PRIORITY. The framework is configured first, so `table` means altea's `table` even if the app
// declared one; a script that wants the other writes the import itself.
//
// A compiled script runs in process with the server's rights.

export namespace EastwindEval {

    /** The eastwind package directory (this module lives in `dist/app/`, so two levels up). */
    const packageDirectory = path.resolve(url.fileURLToPath(new URL(".", import.meta.url)), "../..");

    export function start(sb: SchemaBuilder): void {
        // `baseDirectory` is where a generated eval pretends to live, so `@altea/*` resolves through
        // eastwind's node_modules, and `dist` is found for eastwind's own `.d.ts`.
        EvalLogic.start(sb, { baseDirectory: packageDirectory });

        EvalLogic.configureImports(imports => imports
            // ---- Authorization (see the header: altea-auth cannot contribute itself) ---------------------
            // `AuthLogic` is eager: "who is this, and may they?" belongs in the vocabulary, not behind an
            // import. The entities are lazy, like every other entity.
            .eager("@altea/altea-auth/server/AuthLogic", ["AuthLogic"], { value: authLogic })
            .lazy("@altea/altea-auth/data/User", "*", { value: user })
            .lazy("@altea/altea-auth/data/Role", "*", { value: role })

            // ---- The domain ----------------------------------------------------------------------------
            // EVERY registered entity and enum, whichever package declared it — not just eastwind's own.
            // A script names the entity it is written for, and that entity is as often an altea module's
            // (an EmailTemplate for ResetPasswordRequest, a condition on a Process) as the application's.
            // Narrowing this to ["eastwind"] made those templates uncompilable: "Cannot find name
            // 'ResetPasswordRequestEntity'" in the wrapper the server itself generated.
            .fromSchema());
    }
}
