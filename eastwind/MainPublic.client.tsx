import * as React from "react";
import { createRoot, type Root } from "react-dom/client";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { loadReflectionMetadata } from "@altea/altea/client/ReflectionClient";
import { CultureClient } from "@altea/altea/client/CultureClient";
import { SessionSharing, NotifyPendingFilter } from "@altea/altea/client/Services";
import Notify from "@altea/altea/client/Frames/Notify";
import * as AppContext from "@altea/altea/client/AppContext";
import ErrorModal from "@altea/altea/client/Modals/ErrorModal";
import { AuthClient } from "@altea/altea-auth/client/AuthClient";
import { ResetPasswordClient } from "@altea/altea-auth-reset-password/client/ResetPasswordClient";
import { OpenIDClient } from "@altea/altea-auth-openid/client/OpenIDClient";
import { OpenIDAuthenticator } from "@altea/altea-auth-openid/client/OpenIDAuthenticator";
import { AzureADAuthenticator } from "@altea/altea-auth-azuread/client/AzureADAuthenticator";
import { WindowsADAuthenticator } from "@altea/altea-auth-windowsad/client/WindowsADAuthenticator";
import { EntityOverrides } from "./entityOverrides.data";
import Layout from "./Layout";
import Home from "./Home";
import PublicCatalog from "./publicApi/PublicCatalog";
import NotFound from "./NotFound";

// Register the full free solid + regular icon sets so string-named icons resolve (Signum's
// MainPublic.tsx: library.add(fas, far)). Without this, <FontAwesomeIcon icon="save" /> and
// tuple forms like icon={["fas","layer-group"]} used across the client render nothing.
//
// BRANDS too, which Southwind does NOT add although Signum declares the package: the two `["fab", …]`
// icons in the workspace — @altea/altea-markdown's syntax-cheat-sheet marker and
// @altea/altea-auth-windowsad's sign-in button — rendered as an empty span without it.
library.add(fas, far, fab);

// Wire the global error / unhandled-rejection handlers to the ErrorModal (Southwind's MainPublic.tsx:
// `ErrorModal.register()`). Without this, an unhandled promise rejection — e.g. a failing
// parseFindOptions inside SearchControl's useAPI — is swallowed with only a console message, so the
// SearchModal renders empty instead of surfacing the error.
ErrorModal.register();

// The user name of the server's configured ANONYMOUS USER (starter.server.ts:
// `AuthLogic.start(sb, "System", "Anonymous")`), a literal here exactly as in Southwind's MainPublic. It
// matters only for `isFull` below: a session that IS that user is not an admin session.
const ANONYMOUS_USER_NAME = "Anonymous";

// eastwind SPA bootstrap — Southwind's MainPublic, including its `reload()` shape.
//
// The structure is the point. Southwind builds the route table and the React ROOT from scratch on every
// credential change, because which routes exist depends on WHO is logged in:
//
//     const isFull = Boolean(AuthClient.currentUser()) && AuthClient.currentUser().userName != "Anonymous";
//     if (isFull) (await import("./MainAdmin")).startFull(routes);
//
// An anonymous visitor's router therefore never receives the admin routes at all, so /find/Order falls
// through to NotFound rather than rendering and then failing per request. That IS Signum's client-side
// authorization model — gate by which routes EXIST, and let the server's role rules do the real
// enforcement — and it replaces the ad-hoc redirect guard eastwind's Layout used to carry.
//
// One divergence from Southwind's reload(): **the metadata blob is loaded AFTER the routes are built**,
// where Signum's `reloadTypes()` comes first. `applyMetadata` stamps each DECLARED symbol's database id and
// runs each loaded module's `applyMetadataHooks`, so those modules have to be imported before the blob is
// applied — and importing them is exactly what `startFull` does.
//
// `AppContext.newClientState()` is Signum's `AppContext.clearAllSettings()`: every client REGISTRATION —
// Navigator's entity settings, Finder's query settings and rule lists, the operation settings, the quick
// links, the widget / contextual-item / button-bar providers, the line tasks a module adds — lives in
// `AppContext.clientState`, so dropping it and re-running the bundle is the whole clear/re-register cycle.
// Signum needs a `clearSettingsActions` registry for this; altea needs one object.
let root: Root | undefined = undefined;

// Southwind's `reload()`: resolve who is logged in, build the route table for that user, then throw the
// React root away and build a new one over the new router.
async function reload(): Promise<void> {

    // Resolve the current user from a stored token before anything reads it (Signum's autoLogin).
    await AuthClient.autoLogin();

    // Signum's `AppContext.clearAllSettings()`, and it must come BEFORE the registration calls below:
    // everything they register lives in the client state this drops.
    AppContext.newClientState();

    const routes: RouteObject[] = [];

    // The ANONYMOUS shop window (Southwind's MainPublic pushes the same route first): where the landing
    // page sends a logged-out visitor.
    routes.push({ path: "/publicCatalog", element: <PublicCatalog /> });

    // Public auth routes (login / change password) — always registered, so they work with no user.
    AuthClient.startPublic(routes);

    // Self-service password reset (@altea/altea-auth-reset-password): the /auth/forgotPasswordEmail and
    // /auth/resetPassword pages + the "I have forgotten my password" link under the login form. PUBLIC, for
    // the obvious reason — a visitor who cannot log in has to reach them.
    ResetPasswordClient.startPublic(routes);

    // OpenID Connect (@altea/altea-auth-openid): the /openid-callback route the provider redirects back to.
    OpenIDClient.startPublic(routes);

    // Southwind's `isFull`. The anonymous user is excluded explicitly: with the server's anonymous user
    // configured, a session could be authenticated AS it (a directory authenticator, a stale token), and
    // such a session is not an admin session.
    const user = AuthClient.currentUser();
    const isFull = user != null && user.userName != ANONYMOUS_USER_NAME;

    if (isFull)
        (await import("./MainAdmin.client")).startFull(routes);

    // Boot straight into the remembered culture, so the first paint is already translated (loading the
    // default first and switching after would flash English). AFTER the route build — see the header.
    await loadReflectionMetadata({ culture: CultureClient.savedCulture() });
    document.documentElement.setAttribute("lang", CultureClient.getCurrentCulture());

    const router = createBrowserRouter([{
        path: "/",
        element: <Layout />,
        children: [
            { index: true, element: <Home /> },
            ...routes,
            { path: "*", element: <NotFound /> },
        ],
    }]);

    // Give AppContext the DataRouter so Navigator.navigate / pushOrOpenInTab do SPA navigation
    // (the FrameModal expand link, entity links, etc.) instead of a full page reload.
    AppContext.setRouter(router);

    const el = document.getElementById("root");
    if (el == null)
        return;

    // Southwind unmounts and re-creates the root here for the same reason: the router OBJECT is new, and
    // RouterProvider does not accept a different router on a re-render.
    if (root)
        root.unmount();
    root = createRoot(el);
    root.render(<App router={router} />);
}

// Remount the tree on resetUI (a metadata refetch, a switch-user) so components re-read the new role's
// data. Signum's AppContext.resetUI re-renders the app; the heavier "the route table itself changed" case
// is `reload()` above, which the onLogin / onLogout hooks drive.
function App({ router }: { router: Parameters<typeof RouterProvider>[0]["router"] }): React.JSX.Element {
    const [key, setKey] = React.useState(0);
    React.useEffect(() => {
        AppContext.setResetUI(() => setKey(k => k + 1));
        return () => AppContext.setResetUI(() => { });
    }, []);
    return <RouterProvider key={key} router={router} />;
}

async function boot(): Promise<void> {
    EntityOverrides.start();

    // Route the ajax pending-request count to the Notify host (Signum's MainPublic wiring) so a "loading"
    // toast shows while requests are in flight. The <Notify/> host is mounted in Layout; operation success
    // toasts (Operations.notifySuccess) go through the same singleton.
    NotifyPendingFilter.notifyPendingRequests = pending => Notify.getSingleton()?.notifyPendingRequest(pending);

    // Cross-tab session sharing (Signum's Services.SessionSharing): a NEW tab (empty sessionStorage) asks
    // any other open tab for its sessionStorage — so the auth token carries over and the tab opens already
    // logged in. Must run BEFORE the auth wiring (it namespaces the cross-tab logout signal) and BEFORE
    // reload (whose autoLogin reads the token); awaited so the storage round-trip finishes first.
    await SessionSharing.setAppNameAndRequestSessionStorage("eastwind");

    // Host hooks for the auth module (Signum's MainPublic wires both to `reload`): a credential change
    // changes which routes exist, so both rebuild the app.
    //
    //   onLogin  — rebuild FIRST, then navigate: the target (a dashboard, an entity page) is an admin route
    //              that does not exist until startFull has run.
    //   onLogout — navigate FIRST, then rebuild: leaving the admin route before its route object disappears
    //              avoids a NotFound flash on the way out. Southwind does the same.
    AuthClient.Options.onLogin = (back?: string) => { void reload().then(() => AppContext.navigate(back || "/")); };
    AuthClient.Options.onLogout = async () => { AppContext.navigate("/"); await reload(); };

    // DEV-ONLY password-less login (not in Signum): with VITE_PASSWORD_IS_USERNAME=true the login form
    // drops its password field and sends the user name as the password, so any user of a locally seeded
    // test database (System, Steven, Anne, …) is one field away. The dev seed hashes each user's name as
    // their password (EastwindMigrations.ensureUser). `import.meta.env.DEV` is statically replaced by
    // Vite, so this is dead code in a production build — and it is only a client convenience anyway: the
    // request is the normal /api/auth/login, which the server validates as usual.
    AuthClient.Options.passwordIsUsername = import.meta.env.DEV && import.meta.env.VITE_PASSWORD_IS_USERNAME == "true";

    // The DIRECTORY authenticators, registered BEFORE the first reload (they add themselves to
    // AuthClient.authenticators, which autoLogin walks) and awaited, because each asks the server for its
    // configuration first. Both stand down silently when their module is not configured — the server answers
    // null — so calling both unconditionally is safe and needs no client-side switch.
    await Promise.all([
        AzureADAuthenticator.registerAzureADAuthenticator(),
        OpenIDAuthenticator.registerOpenIDAuthenticator(),
    ]);

    // Windows integrated authentication is the exception: it cannot self-gate (see env.d.ts), so it needs
    // an explicit flag.
    if (import.meta.env.VITE_WINDOWS_AUTH == "true")
        WindowsADAuthenticator.registerWindowsAuthenticator();

    await reload();
}

boot().catch(err => {
    console.error("[eastwind boot] failed:", err);
    const el = document.getElementById("root");
    if (el) el.textContent = "Boot failed: " + (err?.stack ?? err?.message ?? String(err));
});
