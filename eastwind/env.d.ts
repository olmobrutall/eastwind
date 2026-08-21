// Ambient typing for the Vite-injected `import.meta.env` (MainPublic's dev login flag reads it).
// Hand-written rather than `types: ["vite/client"]`, which would also re-declare `*.css` / `*.scss` —
// styles.d.ts already covers those. Only the members actually used are declared.
interface ImportMetaEnv {
    /** true under `vite dev`, false in a production build (statically replaced, so DEV-only branches are dead code). */
    readonly DEV: boolean;
    readonly PROD: boolean;
    /** "true" ⇒ the login form drops its password field and sends the user name as the password (dev only). */
    readonly VITE_PASSWORD_IS_USERNAME?: string;
    /**
     * "true" ⇒ register the Windows integrated-authentication authenticator (@altea/altea-auth-windowsad).
     * A CLIENT flag because, unlike the Azure AD / OpenID authenticators — which ask the server for their
     * configuration and stand down when there is none — this one cannot self-gate: it moves the bearer
     * token to a non-standard header so a proxy can own `Authorization`, which must not happen on a host
     * that is not behind such a proxy. See @altea/altea-auth-windowsad's WindowsADAuthenticator.
     */
    readonly VITE_WINDOWS_AUTH?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
