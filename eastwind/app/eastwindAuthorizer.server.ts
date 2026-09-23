import { AzureADAuthorizer } from "@altea/altea-auth-azuread/server/AzureADAuthorizer";
import { Starter } from "./starter.server";

// The application's authorizer, installed in starter.server.ts: password login, inviting users from the
// directory, and creating / updating the local user when someone signs in through it.
//
// It extends AzureADAuthorizer, so "Sign in with Microsoft" appears once the Azure AD tab of the
// application configuration is filled in. To use another directory, extend its authorizer instead
// (OpenIDAuthorizer, WindowsADAuthorizer) and pass that directory's configuration member.
export class EastwindAuthorizer extends AzureADAuthorizer {
    constructor() {
        super(() => Starter.configuration.value().thenTyped(c => c.azureAD));
    }
}
