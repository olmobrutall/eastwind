import "@altea/altea/server"; // installs save()/toLite()
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import "@altea/altea/server/fluentOperations"; // FluentInclude.withSave / withDelete
import type { SchemaBuilder } from "@altea/altea/server/schema";
import type { ResetLazy } from "@altea/altea/server/resetLazy";
import { table } from "@altea/altea/server/table";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import {
    ApplicationConfigurationEntity, ApplicationConfigurationOperation, currentEnvironment,
} from "./ApplicationConfiguration.data";

// Include the ApplicationConfiguration table, and publish THIS environment's row as the lazy every
// module's configuration lambda reads.
//
// altea's ResetLazy is ASYNC (`value()` returns a Promise) while every module's configuration getter is
// SYNCHRONOUS by contract. The bridge is the lazy's OWN synchronous peek, `valueOrUndefined` — the same
// one the framework's hot-path readers use (TypeLogic.typeToId). There is no second copy of the value
// here to keep in step with the first, and so no way for the two to disagree.
//
// Started LATE: the entity references types the mail module owns, so those includes must already exist.
export namespace GlobalsLogic {

    /** Prefer the sync {@link configuration} — this is for async callers. */
    export let configurationLazy: ResetLazy<ApplicationConfigurationEntity> = null!;

    let started = false;

    /**
     * WHICH configuration row this process runs as — `DB_ENVIRONMENT`, defaulting to "Development".
     *
     * One row per environment, chosen by the deployment rather than by the database's own name. It is also
     * what the migration seeds the row's `environment` with, so a fresh database matches without
     * configuring anything. The value itself lives in the DATA layer, because the entity's `isActive`
     * expression compares against it.
     */
    export function environment(): string {
        return currentEnvironment;
    }

    export function start(sb: SchemaBuilder): void {
        if (started)
            return;
        started = true;

        sb.include(ApplicationConfigurationEntity)
            .withSave(ApplicationConfigurationOperation.Save)
            .withQuery();

        // The "is this the live row?" column of the search page.
        QueryLogic.expressions.register(ApplicationConfigurationEntity, a => a.isActive(),
            { niceName: () => ApplicationConfigurationEntity.nicePropertyName(a => a.isActive()) });

        configurationLazy = sb.globalLazy(
            async () => {
                // Captured into a const: a query lambda translates to SQL, so it cannot CALL environment().
                const name = environment();
                const row = await table(ApplicationConfigurationEntity)
                    .filter(a => a.environment == name).singleOrNull() as ApplicationConfigurationEntity | null;

                if (row == null)
                    throw new Error(`No ApplicationConfiguration row for environment '${name}' (DB_ENVIRONMENT).`
                        + ` A fresh database gets one from the CreateCulturesAndConfiguration migration —`
                        + ` run \`terminal ts\`, or add the row and set its Environment to '${name}'.`);
                return row;
            },
            { invalidateWith: [ApplicationConfigurationEntity] });

        // A save INVALIDATES the lazy, which empties the synchronous peek until something reloads it — and a
        // sync reader cannot await. So reload straight away, in the background: the window in which
        // `configuration()` would throw is one microtask rather than "until the next async reader".
        //
        // Fire-and-forget on purpose. The handler runs inside the save transaction and must not make the
        // save wait on a read; a failure here is the one the next reader would have met anyway, and
        // `ResetLazy` self-evicts a rejection, so it is retried rather than cached.
        sb.schema.entityEvents(ApplicationConfigurationEntity).saved.push(() => { void configurationLazy.value(); });
    }

    /** Load the configuration. Call once at startup, after the schema is ready. */
    export async function warmUp(): Promise<void> {
        if (started)
            await configurationLazy.value();
    }

    /**
     * The configuration SYNCHRONOUSLY, for the app's own seams that cannot await — the counterpart of a
     * module's own `EmailLogic.configurationLoaded()` / `SMSLogic.configurationLoaded()`. It caches nothing
     * of its own: it reads the value the lazy has already stamped, so it cannot go stale.
     *
     * Throws until {@link warmUp} has run, which is deliberate: answering with half a configuration (or an
     * env-var fallback) would hide a database that was never seeded.
     *
     * Anything that CAN await reads `configurationLazy.value()` instead — and a module's settings thunk
     * projects that with `.thenTyped(c => c.member)`, which keeps the promise stable and typed.
     */
    export function configurationLoaded(): ApplicationConfigurationEntity {
        const value = configurationLazy?.valueOrUndefined;
        if (value == null)
            throw new Error("The ApplicationConfiguration is not loaded yet."
                + " GlobalsLogic.warmUp() runs at startup, after schema.initialize();"
                + ` on a fresh database, seed the row for environment '${environment()}' with \`terminal ts\`.`);
        return value;
    }
}
