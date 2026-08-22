import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { ApplicationConfigurationEntity } from "./ApplicationConfiguration.data";

// Port of Southwind's `Globals/GlobalsClient.tsx`: the ApplicationConfiguration view + its search settings.
// (Southwind's other job there — adding the UserEmployeeMixin line to the User view — is done in eastwind by
// the app's entityOverrides + CustomerClient, so it is not repeated here.)
//
// There is no menu entry, as in Southwind: the row is reached through the omnibox / `/find/ApplicationConfiguration`,
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
    }
}
