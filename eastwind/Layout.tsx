import * as React from "react";
import { Link, Outlet, useLocation, Navigate } from "react-router";
import { GlobalModalContainer } from "@altea/altea/client/Modals";
import Notify from "@altea/altea/client/Frames/Notify";
import { ErrorBoundary } from "@altea/altea/client/Components";
import * as AppContext from "@altea/altea/client/AppContext";
import { Breakpoints, useBreakpoint } from "@altea/altea/client/Hooks";
import { LayoutMessage } from "@altea/altea-toolbar/data/Toolbar";
import { SidebarContainer, SidebarToggleItem, type SidebarMode } from "@altea/altea-toolbar/client/SidebarContainer";
import ToolbarRenderer from "@altea/altea-toolbar/client/Renderers/ToolbarRenderer";
import CultureDropdown from "@altea/altea/client/CultureDropdown";
import LoginDropdown from "@altea/altea-auth/client/public/LoginDropdown";
import OmniboxAutocomplete from "@altea/altea-omnibox/client/OmniboxAutocomplete";

// The app shell (Southwind's Layout): a top navbar (with the sidebar toggle, the omnibox and the login/user
// dropdown) + a SIDEBAR rendering the current "Side" toolbar + the routed page via <Outlet/>. Auth-aware: a
// login guard redirects to /auth/login when no user is authenticated. GlobalModalContainer stays mounted for
// every modal host.

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

// Southwind's Layout keeps the sidebar mode in localStorage so it survives a reload; mobile starts hidden.
const SIDEBAR_MODE_KEY = "sidebarMode";

function useSidebarMode(isMobile: boolean): [SidebarMode, (mode: SidebarMode) => void] {
    const [mode, setMode] = React.useState<SidebarMode>(() =>
        (localStorage.getItem(SIDEBAR_MODE_KEY) as SidebarMode | null) ?? (isMobile ? "Hidden" : "Wide"));

    return [mode, (m: SidebarMode) => {
        localStorage.setItem(SIDEBAR_MODE_KEY, m);
        setMode(m);
    }];
}

export default function Layout(): React.JSX.Element {
    const location = useLocation();
    useRerenderOnUserChange();

    const isMobile = useBreakpoint() <= Breakpoints.sm;
    const [sidebarMode, setSidebarMode] = useSidebarMode(isMobile);

    // Secure-by-default on the client too: without a user, only the /auth/* pages (login, change
    // password) are reachable; everything else redirects to the login page.
    const isAuthRoute = location.pathname.startsWith("/auth");
    if (!AppContext.currentUser && !isAuthRoute)
        return <Navigate to="/auth/login" replace />;

    // The sidebar only exists for a logged-in user (the /api/toolbar route answers per role) and never on the
    // login pages.
    const showSidebar = AppContext.currentUser != null && !isAuthRoute && sidebarMode !== "Hidden";

    return (
        <div>
            <nav className="navbar navbar-expand navbar-dark bg-dark px-3">
                {AppContext.currentUser && !isAuthRoute &&
                    <SidebarToggleItem isMobile={isMobile} mode={sidebarMode} setMode={setSidebarMode} />}
                <Link className="navbar-brand" to="/">eastwind</Link>
                {/* The omnibox (Southwind puts it in the navbar too). Only for a logged-in user: the
                    /api/omnibox route asserts OmniboxPermission.ViewOmnibox. */}
                {AppContext.currentUser && <div className="sf-omnibox mx-3"><OmniboxAutocomplete inputAttrs={{ className: "form-control form-control-sm" }} /></div>}
                <div className="navbar-nav ms-auto">
                    {/* Language picker (Southwind's Layout has one too). Renders nothing unless the server
                        reports more than one culture with translations loaded. */}
                    <CultureDropdown isMobile={isMobile} />
                    <LoginDropdown />
                </div>
            </nav>
            {/* Skip-link (Signum's LayoutMessage.JumpToMainContent): the first tab stop jumps past the
                sidebar's nav items straight to the page. */}
            <a href="#sf-main-content" className="visually-hidden-focusable">{LayoutMessage.JumpToMainContent.niceToString()}</a>
            <SidebarContainer
                mode={sidebarMode}
                isMobile={isMobile}
                sidebarContent={showSidebar
                    ? <ToolbarRenderer onAutoClose={isMobile ? () => setSidebarMode("Hidden") : undefined} />
                    : undefined}>
                <div id="sf-main-content" className="container-fluid mt-3">
                    <ErrorBoundary deps={[location.pathname + location.search]}>
                        <Outlet />
                    </ErrorBoundary>
                </div>
            </SidebarContainer>
            <GlobalModalContainer />
            {/* The notification host (Signum's <Notify/>): registers the Notify singleton so ajax "loading"
                toasts and operation "success" toasts have somewhere to render. Must stay mounted app-wide. */}
            <Notify />
        </div>
    );
}
