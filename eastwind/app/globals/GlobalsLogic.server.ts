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

// Port of Southwind's `Globals/GlobalsLogic.cs`: include the ApplicationConfiguration table, and publish THIS
// environment's row as the lazy every module's configuration lambda reads (Signum's
// `Starter.Configuration = sb.GlobalLazy(…, new InvalidateWith(typeof(ApplicationConfigurationEntity)))`).
//
// TWO altea divergences, both forced by the same thing — altea's ResetLazy is ASYNC (`value()` returns a
// Promise) while every module's configuration getter is SYNCHRONOUS:
//
//  1. the lazy is mirrored into a SYNC snapshot (`warm`), filled by `warmUp()` after the schema is ready.
//     The framework keeps no such mirror any more — its readers ask for what they need (TypeLogic.caches(),
//     SymbolLogic.cache(), CultureInfoLogic.lookup()) — but a module configuration getter is synchronous by
//     contract, so this one stays. It cannot go stale: point 2.
//  2. the snapshot is refreshed on the `saved` event rather than only by the lazy's invalidation, because a
//     sync reader cannot await a reload. The lazy is still registered with `invalidateWith`, so the async
//     readers (and the cache panel) see the same invalidation Signum's does.
//
// Started LATE (Southwind calls `GlobalsLogic.Start(sb)` near the end of its Starter): the entity references
// types the mail module owns, so those includes must already exist.
export namespace GlobalsLogic {

    /** Signum's `Starter.Configuration`. Prefer the sync {@link configuration} — this is for async callers. */
    export let configurationLazy: ResetLazy<ApplicationConfigurationEntity> = null!;

    let started = false;
    let warm: ApplicationConfigurationEntity | undefined;

    /**
     * WHICH configuration row this process runs as — `DB_ENVIRONMENT`, defaulting to "Development".
     *
     * This is the counterpart of Signum's `a.DatabaseName == Connector.Current.DatabaseName()`: one row per
     * environment, chosen by the deployment rather than by the database's own name. It is also what the
     * migration seeds the row's `environment` with, so a fresh database matches without configuring anything.
     * The value itself lives in the DATA layer, because the entity's `isActive` expression compares against it.
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

        // The "is this the live row?" column of the search page (Signum's QueryLogic.Expressions.Register).
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

        // Keep the sync snapshot current when the row is edited (see the header). The handler runs inside the
        // save transaction with the saved entity in hand, so no reload is needed.
        sb.schema.entityEvents(ApplicationConfigurationEntity).saved.push(e => { warm = e; });
    }

    /** Load the configuration into the sync snapshot. Call once at startup, after the schema is ready. */
    export async function warmUp(): Promise<void> {
        if (started)
            warm = await configurationLazy.value();
    }

    /**
     * The application's configuration — Signum's `Starter.Configuration.Value`, and what every module's
     * `getConfiguration` lambda reads. Throws until {@link warmUp} has run, which is deliberate: answering a
     * module with half a configuration (or an env-var fallback) would hide a database that was never seeded.
     */
    export function configuration(): ApplicationConfigurationEntity {
        if (warm == null)
            throw new Error("The ApplicationConfiguration is not loaded yet."
                + " GlobalsLogic.warmUp() runs at startup, after schema.initialize();"
                + ` on a fresh database, seed the row for environment '${environment()}' with \`terminal ts\`.`);
        return warm;
    }

    /** Whether the configuration is loaded — for a caller that must not throw (a health check, a startup log). */
    export function isWarm(): boolean { return warm != null; }
}
