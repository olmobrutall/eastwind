import { AzureADAuthorizer } from "@altea/altea-auth-azuread/server/AzureADAuthorizer";
import { Starter } from "./starter.server";

// eastwind's ONE authorizer — `AuthLogic.authorizer`, installed in starter.server.ts. Southwind's
// SouthwindAuthorizer. It owns the password login, "invite a user from the directory", and the
// create/update of the local user every directory sign-in goes through.
//
// It extends AzureADAuthorizer because Entra is what almost every application uses, and the "Sign in with
// Microsoft" button shows only once the Azure AD tab of the configuration row is filled in. OpenID and
// WindowsAD are started too, but they sign in only when THEIR authorizer is the installed one: to use one,
// change the base class below to OpenIDAuthorizer / WindowsADAuthorizer and pass the matching getter.
// Removing the AzureAD module leaves the base class unresolved ON PURPOSE — the build then asks for that
// decision instead of silently dropping directory login.

export class EastwindAuthorizer extends AzureADAuthorizer {
    constructor() {
        // One configuration for every AD variant; re-read per call so an edit applies without a restart.
        super(() => Starter.configuration.value().thenTyped(c => c.azureAD));
    }
}

/** OpenID Connect — `openID` on the configuration row; the getter for an OpenIDAuthorizer base. */
export function openIDConfiguration() {
    return Starter.configuration.value().thenTyped(c => c.openID);
}//OpenIDConfiguration

/** Windows AD over LDAP — `windowsAD` on the configuration row; the getter for a WindowsADAuthorizer base. */
export function windowsADConfiguration() {
    return Starter.configuration.value().thenTyped(c => c.windowsAD);
}//WindowsADConfiguration
