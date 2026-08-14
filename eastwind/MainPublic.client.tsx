import * as React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";
import { loadReflectionMetadata } from "@altea/altea/client/ReflectionClient";
import { SessionSharing, NotifyPendingFilter } from "@altea/altea/client/Services";
import Notify from "@altea/altea/client/Frames/Notify";
import * as AppContext from "@altea/altea/client/AppContext";
import ErrorModal from "@altea/altea/client/Modals/ErrorModal";
import { AuthClient } from "@altea/altea-auth/client/AuthClient";
import { EntityOverrides } from "./entityOverrides.data";
import Layout from "./Layout";
import Home from "./Home";
import NotFound from "./NotFound";

// Register the full free solid + regular icon sets so string-named icons resolve (Signum's
// MainPublic.tsx: library.add(fas, far)). Without this, <FontAwesomeIcon icon="save" /> and
// tuple forms like icon={["fas","layer-group"]} used across the client render nothing.
library.add(fas, far);

// Wire the global error / unhandled-rejection handlers to the ErrorModal (Southwind's MainPublic.tsx:
// `ErrorModal.register()`). Without this, an unhandled promise rejection — e.g. a failing
// parseFindOptions inside SearchControl's useAPI — is swallowed with only a console message, so the
// SearchModal renders empty instead of surfacing the error.
ErrorModal.register();

// eastwind SPA bootstrap (Southwind's MainPublic). Apply the shared EntityOverrides, register the full
// client via MainAdmin.startFull (which imports the entity clients → registers every entity type), THEN
// load the reflection metadata (translations + operations → TypeInfo + queries, which need the types
// registered first), and mount the router. No auth gating in eastwind — always full.
async function boot(): Promise<void> {
    EntityOverrides.start();

    // Route the ajax pending-request count to the Notify host (Signum's MainPublic wiring) so a "loading"
    // toast shows while requests are in flight. The <Notify/> host is mounted in Layout; operation success
    // toasts (Operations.notifySuccess) go through the same singleton.
    NotifyPendingFilter.notifyPendingRequests = pending => Notify.getSingleton()?.notifyPendingRequest(pending);

    // Cross-tab session sharing (Signum's Services.SessionSharing): a NEW tab (empty sessionStorage) asks
    // any other open tab for its sessionStorage — so the auth token carries over and the tab opens already
    // logged in. Must run BEFORE startPublic (namespaces the cross-tab logout signal) and BEFORE autoLogin
    // (which reads the token); awaited so the storage round-trip finishes before the token is read.
    await SessionSharing.setAppNameAndRequestSessionStorage("eastwind");

    // Host hooks for the auth module (Signum's MainPublic wires these): where to go after login / logout.
    AuthClient.Options.onLogin = (back?: string) => AppContext.navigate(back || "/");
    AuthClient.Options.onLogout = () => { AppContext.navigate("/auth/login"); return Promise.resolve(); };

    const routes: RouteObject[] = [];
    // Public auth routes (login / change password) — registered here, NOT in the admin bundle, so they
    // are available even when no user is logged in.
    AuthClient.startPublic(routes);
    (await import("./MainAdmin.client")).startFull(routes);

    await loadReflectionMetadata();

    // Resolve the current user from a stored token before the first render (Signum's autoLogin).
    await AuthClient.autoLogin();

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

    // Remount the tree on resetUI (login / logout / metadata refetch) so components re-read the new
    // role's data (e.g. Home's role-filtered query list). Signum's AppContext.resetUI re-renders the app.
    function App(): React.JSX.Element {
        const [key, setKey] = React.useState(0);
        React.useEffect(() => {
            AppContext.setResetUI(() => setKey(k => k + 1));
            return () => AppContext.setResetUI(() => { });
        }, []);
        return <RouterProvider key={key} router={router} />;
    }

    const el = document.getElementById("root");
    if (el)
        createRoot(el).render(<App />);
}

boot().catch(err => {
    console.error("[eastwind boot] failed:", err);
    const el = document.getElementById("root");
    if (el) el.textContent = "Boot failed: " + (err?.stack ?? err?.message ?? String(err));
});
