import * as React from "react";
import { Link, Outlet, useLocation, Navigate } from "react-router";
import { GlobalModalContainer } from "@altea/altea/client/Modals";
import Notify from "@altea/altea/client/Frames/Notify";
import { ErrorBoundary } from "@altea/altea/client/Components";
import * as AppContext from "@altea/altea/client/AppContext";
import LoginDropdown from "@altea/altea-auth/client/public/LoginDropdown";
import OmniboxAutocomplete from "@altea/altea-omnibox/client/OmniboxAutocomplete";

// The app shell (Southwind's Layout): a top navbar (with the login/user dropdown) + the routed page via
// <Outlet/>. Now auth-aware: a login guard redirects to /auth/login when no user is authenticated, and
// the navbar shows the LoginDropdown. GlobalModalContainer stays mounted for every modal host.

// Re-render this shell whenever the current user changes (login / logout / switch user), so the guard
// and the dropdown reflect the new state.
function useRerenderOnUserChange(): void {
    const [, setN] = React.useState(0);
    React.useEffect(() => {
        const fn = (): void => setN(n => n + 1);
        AppContext.currentUserChanged.push(fn);
        return () => {
            const i = AppContext.currentUserChanged.indexOf(fn);
            if (i >= 0) AppContext.currentUserChanged.splice(i, 1);
        };
    }, []);
}

export default function Layout(): React.JSX.Element {
    const location = useLocation();
    useRerenderOnUserChange();

    // Secure-by-default on the client too: without a user, only the /auth/* pages (login, change
    // password) are reachable; everything else redirects to the login page.
    const isAuthRoute = location.pathname.startsWith("/auth");
    if (!AppContext.currentUser && !isAuthRoute)
        return <Navigate to="/auth/login" replace />;

    return (
        <div className="sf-page-container">
            <nav className="navbar navbar-expand navbar-dark bg-dark px-3">
                <Link className="navbar-brand" to="/">eastwind</Link>
                {/* The omnibox (Southwind puts it in the navbar too). Only for a logged-in user: the
                    /api/omnibox route asserts OmniboxPermission.ViewOmnibox. */}
                {AppContext.currentUser && <div className="sf-omnibox mx-3"><OmniboxAutocomplete inputAttrs={{ className: "form-control form-control-sm" }} /></div>}
                <div className="navbar-nav ms-auto">
                    <LoginDropdown />
                </div>
            </nav>
            <div className="container-fluid mt-3">
                <ErrorBoundary deps={[location.pathname + location.search]}>
                    <Outlet />
                </ErrorBoundary>
            </div>
            <GlobalModalContainer />
            {/* The notification host (Signum's <Notify/>): registers the Notify singleton so ajax "loading"
                toasts and operation "success" toasts have somewhere to render. Must stay mounted app-wide. */}
            <Notify />
        </div>
    );
}
