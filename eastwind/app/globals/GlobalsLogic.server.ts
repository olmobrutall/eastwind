import "@altea/altea/server"; // installs save()/toLite()
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import "@altea/altea/server/fluentOperations"; // FluentInclude.withSave / withDelete
import type { SchemaBuilder } from "@altea/altea/server/schema";
import { table } from "@altea/altea/server/table";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import {
    ApplicationConfigurationEntity, ApplicationConfigurationOperation, currentEnvironment,
} from "./ApplicationConfiguration.data";
import { Starter } from "../starter.server";

// Include the ApplicationConfiguration table, and publish THIS environment's row as `Starter.configuration`,
// the lazy every module's configuration lambda reads (Southwind's GlobalsLogic assigns Starter.Configuration).
//
// Every reader is ASYNC: a module's settings thunk projects the lazy's promise with `.thenTyped(c => c.x)`,
// so a save only has to INVALIDATE it (`invalidateWith`) and the next read loads the new row.
//
// Started LATE: the entity references types the mail module owns, so those includes must already exist.
export namespace GlobalsLogic {

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

        Starter.configuration = sb.globalLazy(
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
    }
}
