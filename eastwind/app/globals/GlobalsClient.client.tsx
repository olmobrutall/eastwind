import * as React from "react";
import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { Navigator } from "@altea/altea/client/Navigator";
import { EntityLine } from "@altea/altea/client/Lines/EntityLine";
import { UserEntity } from "@altea/altea-auth/data/User";
import { ApplicationConfigurationEntity } from "./ApplicationConfiguration.data";
import { UserEmployeeMixin } from "./UserEmployeeMixin.data";

// The ApplicationConfiguration view + its search settings,
// and the UserEmployeeMixin line added to the User view right after its Role line.
//
// There is no menu entry: the row is reached through the omnibox / `/find/ApplicationConfiguration`,
// and only a role with Read on the type sees it at all.
export namespace GlobalsClient {
    export function start(cb: ClientBuilder): void {
        cb.configure(ApplicationConfigurationEntity)
            .withView(() => import("./ApplicationConfiguration"))
            .withQuerySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.isActive()),
                    token(a => a.environment),
                    token(a => a.email.sendEmails),
                    token(a => a.email.overrideEmailAddress),
                    token(a => a.email.defaultCulture),
                    token(a => a.email.urlLeft),
                ],
            }));

        // Override the User view to insert the mixin line after `role`.
        // `getSettings(…)!` and not `getOrAddSettings`: this must run AFTER the settings
        // exist (AuthAdminClient.start — see MainAdmin), and claiming them here instead would make that
        // start throw "Key User already added". A missing view is a wiring bug, so it should be loud.
        Navigator.getSettings(UserEntity)!.overrideView(rep => {
            rep.insertAfterLine(u => u.role, ctx => [
                <EntityLine ctx={ctx.subCtx(u => u.mixin(UserEmployeeMixin).employee)} />,
            ]);
        });
    }
}
