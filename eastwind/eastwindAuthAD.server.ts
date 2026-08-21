import { table } from "@altea/altea/server/table";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import type { Lite } from "@altea/altea/data/lite";
import { RoleEntity } from "@altea/altea-auth/data/Role";
import { AzureADConfigurationEmbedded, AzureADType } from "@altea/altea-auth-azuread/data/AzureAD";
import { OpenIDConfigurationEmbedded } from "@altea/altea-auth-openid/data/OpenID";
import { WindowsADConfigurationEmbedded } from "@altea/altea-auth-windowsad/data/WindowsAD";

// eastwind's side of the three DIRECTORY LOGIN modules (@altea/altea-auth-azuread, -openid, -windowsad).
//
// Southwind keeps this in its persisted `ApplicationConfiguration` and hands the module a getter
// (`AuthLogic.Authorizer = new SouthwindAuthorizer(adVariant => Configuration.Value.AzureAD)`). eastwind has
// no such entity, so — exactly as with the mail settings (see eastwindEmail.server.ts) — the configuration
// comes from the ENVIRONMENT, with everything DISABLED by default: a local database logs in against its own
// user table and never reaches for a directory.
//
// ONE PROVIDER AT A TIME. `AuthLogic.authorizer` is a single slot (Signum's `ICustomAuthorizer?`), so at most
// one directory can own the login flow. `EASTWIND_AD_PROVIDER` picks which:
//
//     EASTWIND_AD_PROVIDER = azuread (default, as in Southwind) | openid | windowsad
//
// Only the AzureAD module contributes TABLES (ADGroup + CachedProfilePhoto), and eastwind starts it
// unconditionally — again as Southwind does — so switching the provider never changes the schema. What the
// switch changes is which authorizer is installed, i.e. which directory an interactive sign-in talks to.

export type ADProvider = "azuread" | "openid" | "windowsad";

export namespace EastwindAuthAD {

    /** Which directory owns the interactive login (see the header). */
    export function provider(): ADProvider {
        const value = (process.env["EASTWIND_AD_PROVIDER"] ?? "azuread").toLowerCase();
        return value === "openid" || value === "windowsad" ? value : "azuread";
    }

    /**
     * The role a directory user with no `roleMapping` match is created with. Null by default, which means
     * auto-creation is refused with "No default role set" — the safe direction. Set it directly, or name a
     * role in `EASTWIND_AD_DEFAULT_ROLE` and let `resolveDefaultRoleFromEnv()` look it up at boot.
     */
    export let defaultRole: Lite<RoleEntity> | null = null;

    /**
     * Resolve `EASTWIND_AD_DEFAULT_ROLE` (a role NAME) into `defaultRole`. Called from the starter after
     * `schema.initialize()`, and tolerant of a not-yet-generated database — the configuration getters are
     * synchronous, so the lookup cannot happen inside them.
     */
    export async function resolveDefaultRoleFromEnv(): Promise<void> {
        const name = process.env["EASTWIND_AD_DEFAULT_ROLE"];
        if (name == null || name === "")
            return;

        try {
            const role = await ExecutionMode.global(() =>
                table(RoleEntity).filter(r => r.name == name).singleOrNull()) as RoleEntity | null;

            if (role == null)
                console.warn(`[auth-ad] EASTWIND_AD_DEFAULT_ROLE names role '${name}', which does not exist.`);
            else
                defaultRole = role.toLite() as Lite<RoleEntity>;
        } catch {
            // The role table does not exist yet (a fresh `create`); the next boot resolves it.
        }
    }

    // ---- Azure AD / Entra ID ---------------------------------------------------------------------------

    let azureAD: AzureADConfigurationEmbedded | undefined;

    /**
     * `EASTWIND_AZUREAD_*`: ENABLED, TYPE (AzureAD | B2C | ExternalID), APPLICATION_ID, DIRECTORY_ID,
     * TENANT_NAME, CLIENT_SECRET, SIGNIN_SIGNUP_FLOW, SIGNIN_FLOW, SIGNUP_FLOW, EDIT_PROFILE_FLOW,
     * RESET_PASSWORD_FLOW, AUTO_CREATE_USERS, AUTO_UPDATE_USERS, USE_DELEGATED_PERMISSION.
     */
    export function azureADConfiguration(): AzureADConfigurationEmbedded | null {
        azureAD ??= AzureADConfigurationEmbedded.create({
            enabled: flag("EASTWIND_AZUREAD_ENABLED"),
            type: azureADType(),
            applicationID: text("EASTWIND_AZUREAD_APPLICATION_ID") ?? "",
            directoryID: text("EASTWIND_AZUREAD_DIRECTORY_ID") ?? "",
            tenantName: text("EASTWIND_AZUREAD_TENANT_NAME"),
            clientSecret: text("EASTWIND_AZUREAD_CLIENT_SECRET"),
            signInSignUp_UserFlow: text("EASTWIND_AZUREAD_SIGNIN_SIGNUP_FLOW"),
            signIn_UserFlow: text("EASTWIND_AZUREAD_SIGNIN_FLOW"),
            signUp_UserFlow: text("EASTWIND_AZUREAD_SIGNUP_FLOW"),
            editProfile_UserFlow: text("EASTWIND_AZUREAD_EDIT_PROFILE_FLOW"),
            resetPassword_UserFlow: text("EASTWIND_AZUREAD_RESET_PASSWORD_FLOW"),
            useDelegatedPermission: flag("EASTWIND_AZUREAD_USE_DELEGATED_PERMISSION"),
            allowMatchUsersBySimpleUserName: flag("EASTWIND_AZUREAD_MATCH_SIMPLE_USER_NAME", true),
            autoCreateUsers: flag("EASTWIND_AZUREAD_AUTO_CREATE_USERS"),
            autoUpdateUsers: flag("EASTWIND_AZUREAD_AUTO_UPDATE_USERS"),
        });

        // Read through on every call: the default role is resolved AFTER the configuration is first built.
        azureAD.defaultRole = defaultRole;
        return azureAD;
    }

    function azureADType(): AzureADType {
        switch ((process.env["EASTWIND_AZUREAD_TYPE"] ?? "").toLowerCase()) {
            case "b2c": return AzureADType.B2C;
            case "externalid": return AzureADType.ExternalID;
            default: return AzureADType.AzureAD;
        }
    }

    // ---- OpenID Connect --------------------------------------------------------------------------------

    let openID: OpenIDConfigurationEmbedded | undefined;

    /**
     * `EASTWIND_OPENID_*`: ENABLED, AUTHORITY, CLIENT_ID, CLIENT_SECRET, SCOPES (space-separated),
     * ROLE_CLAIM_PATH, AVOID_SSL_VERIFY, AUTO_CREATE_USERS, AUTO_UPDATE_USERS.
     */
    export function openIDConfiguration(): OpenIDConfigurationEmbedded | null {
        openID ??= OpenIDConfigurationEmbedded.create({
            enabled: flag("EASTWIND_OPENID_ENABLED"),
            authority: text("EASTWIND_OPENID_AUTHORITY"),
            clientId: text("EASTWIND_OPENID_CLIENT_ID"),
            clientSecret: text("EASTWIND_OPENID_CLIENT_SECRET"),
            scopes: text("EASTWIND_OPENID_SCOPES"),
            roleClaimPath: text("EASTWIND_OPENID_ROLE_CLAIM_PATH"),
            avoidSSLVerify: flag("EASTWIND_OPENID_AVOID_SSL_VERIFY"),
            allowMatchUsersBySimpleUserName: flag("EASTWIND_OPENID_MATCH_SIMPLE_USER_NAME", true),
            autoCreateUsers: flag("EASTWIND_OPENID_AUTO_CREATE_USERS"),
            autoUpdateUsers: flag("EASTWIND_OPENID_AUTO_UPDATE_USERS"),
        });

        openID.defaultRole = defaultRole;
        return openID;
    }

    // ---- Windows Active Directory ----------------------------------------------------------------------

    let windowsAD: WindowsADConfigurationEmbedded | undefined;

    /**
     * `EASTWIND_WINDOWSAD_*`: ENABLED (the LDAP credential login), WINDOWS_AUTH (integrated SSO — needs a
     * Negotiate provider, see the module's WindowsADServer), DOMAIN_NAME, LDAP_URL, BASE_DN,
     * REGISTRY_USERNAME, REGISTRY_PASSWORD, AUTO_CREATE_USERS, AUTO_UPDATE_USERS.
     */
    export function windowsADConfiguration(): WindowsADConfigurationEmbedded | null {
        windowsAD ??= WindowsADConfigurationEmbedded.create({
            loginWithActiveDirectoryRegistry: flag("EASTWIND_WINDOWSAD_ENABLED"),
            loginWithWindowsAuthenticator: flag("EASTWIND_WINDOWSAD_WINDOWS_AUTH"),
            domainName: text("EASTWIND_WINDOWSAD_DOMAIN_NAME"),
            ldapUrl: text("EASTWIND_WINDOWSAD_LDAP_URL"),
            baseDN: text("EASTWIND_WINDOWSAD_BASE_DN"),
            directoryRegistry_Username: text("EASTWIND_WINDOWSAD_REGISTRY_USERNAME"),
            directoryRegistry_Password: text("EASTWIND_WINDOWSAD_REGISTRY_PASSWORD"),
            allowMatchUsersBySimpleUserName: flag("EASTWIND_WINDOWSAD_MATCH_SIMPLE_USER_NAME", true),
            autoCreateUsers: flag("EASTWIND_WINDOWSAD_AUTO_CREATE_USERS"),
            autoUpdateUsers: flag("EASTWIND_WINDOWSAD_AUTO_UPDATE_USERS"),
        });

        windowsAD.defaultRole = defaultRole;
        return windowsAD;
    }
}

function text(name: string): string | null {
    const value = process.env[name];
    return value == null || value === "" ? null : value;
}

function flag(name: string, fallback = false): boolean {
    const value = process.env[name];
    return value == null || value === "" ? fallback : value === "true";
}
