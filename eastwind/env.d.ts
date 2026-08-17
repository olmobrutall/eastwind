// Ambient typing for the Vite-injected `import.meta.env` (MainPublic's dev login flag reads it).
// Hand-written rather than `types: ["vite/client"]`, which would also re-declare `*.css` / `*.scss` —
// styles.d.ts already covers those. Only the members actually used are declared.
interface ImportMetaEnv {
    /** true under `vite dev`, false in a production build (statically replaced, so DEV-only branches are dead code). */
    readonly DEV: boolean;
    readonly PROD: boolean;
    /** "true" ⇒ the login form drops its password field and sends the user name as the password (dev only). */
    readonly VITE_PASSWORD_IS_USERNAME?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
