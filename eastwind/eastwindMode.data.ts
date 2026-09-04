/**
 * This deployment's MODE — the one fact both tiers must agree on before anything else runs.
 *
 * Declared in the DATA layer because it crosses the wire and BOTH halves read it: the server sets it from
 * the `LegacyMode` environment variable, the client fetches it from `/api/eastwind/appMode`, and
 * `EntityOverrides` — which runs on both — takes it as an argument.
 */
export interface EastwindMode {
    /**
     * Declare and start only what SOUTHWIND does.
     *
     * The app is pointed at a database a Signum application generated, so a `sync` should read as a
     * MIGRATION of the tables both applications have rather than also creating a dozen this one invented.
     * It gates two different things, and both matter: the module `start` calls in the Starter, and the
     * `implementedBy` lists in EntityOverrides — a list decides what the editor offers AND which tables the
     * schema creates, so several of those lists are themselves the difference between the two shapes.
     *
     * It does NOT gate the places where altea's model simply differs INSIDE a module both apps run (the AD
     * configurations altea persists as rows where Southwind keeps them in appsettings, the mail service
     * embeddeds it models as `@part` entities). Those are model decisions, not module registration.
     */
    southwindOnly: boolean;
}

/** What an unreachable route or an older server means: the full module set. */
export const FULL_MODE: EastwindMode = { southwindOnly: false };

// The mode this client booted with. MainPublic fills it from the server before anything else runs; every
// other client module reads it here rather than fetching again (the shape altea's own resolver slots use).
let current: EastwindMode = FULL_MODE;

export function setCurrentMode(mode: EastwindMode): void { current = mode; }
export function currentMode(): EastwindMode { return current; }
