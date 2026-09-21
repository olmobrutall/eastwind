import type { AzureADConfigurationEmbedded } from "@altea/altea-auth-azuread/data/AzureAD";
import type { OpenIDConfigurationEmbedded } from "@altea/altea-auth-openid/data/OpenID";
import type { WindowsADConfigurationEmbedded } from "@altea/altea-auth-windowsad/data/WindowsAD";
import { GlobalsLogic } from "./globals/GlobalsLogic.server";

// eastwind's side of the three DIRECTORY LOGIN modules (@altea/altea-auth-azuread, -openid, -windowsad).
//
// The SETTINGS live on the ApplicationConfiguration row and each module reads them through the getter below,
// which is what installs the directory authorizer over the configuration row: a null answer means "this
// directory is not configured", and the module stands down. Everything
// is null on a fresh database, so a local database logs in against its own user table and never reaches for a
// directory — and enabling one is an edit on the configuration page, not a redeployment.
//
// What is NOT data: WHICH provider owns the login. `AuthLogic.authorizer` is a single slot, and the
// choice is made while the schema is being built, before any row can be read —
// so it stays an environment switch:
//
//     EASTWIND_AD_PROVIDER = azuread (default) | openid | windowsad
//
// Only the AzureAD module contributes TABLES (ADGroup + CachedProfilePhoto), and eastwind starts it
// unconditionally — so switching the provider never changes the schema. What the
// switch changes is which authorizer is installed, i.e. which directory an interactive sign-in talks to.

export type ADProvider = "azuread" | "openid" | "windowsad";

export namespace EastwindAuthAD {

    /** Which directory owns the interactive login (see the header). */
    export function provider(): ADProvider {
        const value = (process.env["EASTWIND_AD_PROVIDER"] ?? "azuread").toLowerCase();
        return value === "openid" || value === "windowsad" ? value : "azuread";
    }

    /** Entra ID / Azure AD — `azureAD` on the configuration row. */
    export function azureADConfiguration(): AzureADConfigurationEmbedded | null {
        return GlobalsLogic.configuration().azureAD;
    }

    /** OpenID Connect — `openID` on the configuration row. */
    export function openIDConfiguration(): OpenIDConfigurationEmbedded | null {
        return GlobalsLogic.configuration().openID;
    }

    /** Windows AD over LDAP — `windowsAD` on the configuration row. */
    export function windowsADConfiguration(): WindowsADConfigurationEmbedded | null {
        return GlobalsLogic.configuration().windowsAD;
    }
}
