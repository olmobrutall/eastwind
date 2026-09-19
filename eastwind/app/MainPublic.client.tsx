import * as React from "react";
import { ajaxGet } from "@altea/altea/client/Services";
import { FULL_MODE, setCurrentMode, type EastwindMode } from "./eastwindMode.data";
import { createRoot, type Root } from "react-dom/client";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { ReactWidgetsLocalization } from "@altea/altea/client/Lines/ReactWidgetsLocalizer";
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
import { VisualTipClient } from "@altea/altea/client/Basics/VisualTipClient";
import { ResetPasswordClient } from "@altea/altea-auth-reset-password/client/ResetPasswordClient";
import { OpenIDClient } from "@altea/altea-auth-openid/client/OpenIDClient";
import { OpenIDAuthenticator } from "@altea/altea-auth-openid/client/OpenIDAuthenticator";
import { AzureADAuthenticator } from "@altea/altea-auth-azuread/client/AzureADAuthenticator";
import { WindowsADAuthenticator } from "@altea/altea-auth-windowsad/client/WindowsADAuthenticator";
import { EntityOverrides } from "./entityOverrides.data";
import { showBootFailure } from "./bootFailure.client";
import Layout from "./Layout";
import Home from "./Home";
import PublicCatalog from "./publicApi/PublicCatalog";
import { PublicClient } from "./publicApi/PublicClient.client";
import NotFound from "./NotFound";

// eastwind SPA bootstrap — Southwind's MainPublic, including its `reload()` shape: the route table and the
// React ROOT are built from scratch on every credential change, because which routes EXIST depends on who
// is logged in. That IS Signum's client-side authorization model; the divergences from Southwind's version
// (and why each line is where it is) are recorded in **docs/Wiring.md**.

// Southwind's `library.add(fas, far)`, plus BRANDS — which it does not add although Signum declares the
// package, so the two `["fab", …]` icons in the workspace rendered as an empty span.
library.add(fas, far, fab);

// Wire the global error / unhandled-rejection handlers (Southwind's `ErrorModal.register()`).
ErrorModal.register();

// The user name of the server's configured ANONYMOUS USER (starter.server.ts: `AuthLogic.start(sb,
// "System", "Anonymous")`), a literal here exactly as in Southwind's MainPublic.
const ANONYMOUS_USER_NAME = "Anonymous";

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

    // The two ANONYMOUS app routes: the shop window a logged-out visitor is sent to, and the self-service
    // registration page an employee hands out as `/registerUser/<their id>`.
    routes.push({ path: "/publicCatalog", element: <PublicCatalog /> });
    PublicClient.startPublic(routes);

    // Public auth routes (login / change password) — always registered, so they work with no user.
    // `userTicket: true` renders the "Remember me" checkbox; the server half is opted into separately by
    // `UserTicketLogic.start` in the Starter. The authenticator MUST precede autoLogin, which consults it.
    AuthClient.startPublic(routes, { userTicket: true });
    AuthClient.registerUserTicketAuthenticator();

    // The session cache of "which tips has this user read". PUBLIC, because the login screen renders
    // SearchControls too, and because the reset it registers must be in place before the first user change.
    VisualTipClient.start();

    // The reset-password pages and the OpenID callback route — PUBLIC for the obvious reason.
    ResetPasswordClient.startPublic(routes);
    OpenIDClient.startPublic(routes);

    // Southwind's `isFull`. The anonymous user is excluded explicitly: with the server's anonymous user
    // configured, a session could be authenticated AS it, and such a session is not an admin session.
    const user = AuthClient.currentUser();
    const isFull = user != null && user.userName != ANONYMOUS_USER_NAME;

    if (isFull)
        (await import("./MainAdmin.client")).startFull(routes, mode.legacyMode);

    // Boot straight into the remembered culture, so the first paint is already translated. AFTER the route
    // build — the metadata blob's symbol ids and per-module hooks need those modules imported first.
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

    // Give AppContext the DataRouter so Navigator.navigate / pushOrOpenInTab do SPA navigation.
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
// data. The heavier "the route table itself changed" case is `reload()` above.
function App({ router }: { router: Parameters<typeof RouterProvider>[0]["router"] }): React.JSX.Element {
    const [key, setKey] = React.useState(0);
    React.useEffect(() => {
        AppContext.setResetUI(() => setKey(k => k + 1));
        return () => AppContext.setResetUI(() => { });
    }, []);
    // ONE provider for react-widgets' own localization, wrapped around the whole router — Signum's shape
    // (Southwind's MainPublic does the same). Each widget site used to wrap itself, which bought nothing
    // and meant a newly added react-widgets control silently rendered its built-in English until someone
    // remembered to wrap it.
    return (
        <ReactWidgetsLocalization>
            <RouterProvider key={key} router={router} />
        </ReactWidgetsLocalization>
    );
}

/** The stashed router Location → a url string. Signum's `navigate` takes react-router's `To`, so it can be
 *  handed the Location object directly; altea's takes a plain string. */
function backUrl(loc: AppContext.RouterLocation | undefined): string | undefined {
    return loc?.pathname == null ? undefined : loc.pathname + (loc.search ?? "") + (loc.hash ?? "");
}

// This deployment's mode, fetched once at boot. Defaults to the full module set, which is what an
// unreachable route or an older server means.
let mode: EastwindMode = FULL_MODE;

async function boot(): Promise<void> {
    // This deployment's MODE, from the SERVER — the flag lives in its environment, and EntityOverrides runs
    // on both tiers and must reach the same answer. Anonymous and first: everything below is downstream.
    mode = await ajaxGet<EastwindMode>({ url: "/api/eastwind/appMode" }).catch(() => FULL_MODE);
    setCurrentMode(mode);

    EntityOverrides.start({ legacyMode: mode.legacyMode });

    // Route the ajax pending-request count to the Notify host (Signum's MainPublic wiring); the <Notify/>
    // host is mounted in Layout.
    NotifyPendingFilter.notifyPendingRequests = pending => Notify.getSingleton()?.notifyPendingRequest(pending);

    // Cross-tab session sharing: a NEW tab asks any other open tab for its sessionStorage, so the auth
    // token carries over. Before the auth wiring and before reload, and awaited (docs/Wiring.md).
    await SessionSharing.setAppNameAndRequestSessionStorage("eastwind");

    // Host hooks for the auth module (Signum wires both to `reload`): a credential change changes which
    // routes exist. onLogin rebuilds then navigates; onLogout navigates then rebuilds (docs/Wiring.md).
    AuthClient.Options.onLogin = (back?: string) => {
        void reload().then(() => AppContext.navigate(backUrl(AppContext.location().state?.back) ?? (back || "/")));
    };
    AuthClient.Options.onLogout = async () => { AppContext.navigate("/"); await reload(); };

    // DEV-ONLY password-less login (not in Signum): the form drops its password field and sends the user
    // name as the password, which the dev seed hashes as each user's password. `import.meta.env.DEV` is
    // statically replaced by Vite, so this is dead code in a production build.
    AuthClient.Options.passwordIsUsername = import.meta.env.DEV && import.meta.env.VITE_PASSWORD_IS_USERNAME == "true";

    // The DIRECTORY authenticators, registered BEFORE the first reload and awaited (each asks the server
    // for its configuration). Both stand down silently when their module is not configured.
    await Promise.all([
        AzureADAuthenticator.registerAzureADAuthenticator(),
        OpenIDAuthenticator.registerOpenIDAuthenticator(),
    ]);

    // Windows integrated authentication is the exception: it cannot self-gate (see env.d.ts).
    if (import.meta.env.VITE_WINDOWS_AUTH == "true")
        WindowsADAuthenticator.registerWindowsAuthenticator();

    await reload();
}

boot().catch(err => {
    console.error("[eastwind boot] failed:", err);
    showBootFailure(err);
});
