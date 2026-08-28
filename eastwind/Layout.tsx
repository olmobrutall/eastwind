import * as React from "react";
import { Link, Outlet, useLocation } from "react-router";
import { GlobalModalContainer } from "@altea/altea/client/Modals";
import Notify from "@altea/altea/client/Frames/Notify";
import { ErrorBoundary } from "@altea/altea/client/Components";
import * as AppContext from "@altea/altea/client/AppContext";
import { Breakpoints, useBreakpoint } from "@altea/altea/client/Hooks";
import { LayoutMessage } from "@altea/altea-toolbar/data/Toolbar";
import { SidebarContainer, SidebarToggleItem, type SidebarMode } from "@altea/altea-toolbar/client/SidebarContainer";
import ToolbarRenderer from "@altea/altea-toolbar/client/Renderers/ToolbarRenderer";
import CultureDropdown from "@altea/altea/client/CultureDropdown";
import { ThemeModeSelector } from "@altea/altea/client/Components/ThemeModeSelector";
import LoginDropdown from "@altea/altea-auth/client/public/LoginDropdown";
import OmniboxAutocomplete from "@altea/altea-omnibox/client/OmniboxAutocomplete";
import AlertDropdown from "@altea/altea-alert/client/AlertDropdown";
import WhatsNewDropdown from "@altea/altea-whats-new/client/WhatsNewDropdown";
import { ThemeSelector } from "./ThemeSelector";

const ChatbotButton = React.lazy(() => import("@altea/altea-agent/client/ChatbotButton"));

// The app shell (Southwind's Layout): a top navbar (with the sidebar toggle, the omnibox and the login/user
// dropdown) + a SIDEBAR rendering the current "Side" toolbar + the routed page via <Outlet/>. Auth-aware only
// in what it SHOWS — every navbar item that needs a user checks for one; there is no redirect guard (see the
// note in the component). GlobalModalContainer stays mounted for every modal host.

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

function storedSidebarMode(): SidebarMode | null {
    return localStorage.getItem(SIDEBAR_MODE_KEY) as SidebarMode | null;
}

function useSidebarMode(isMobile: boolean): [SidebarMode, (mode: SidebarMode) => void] {
    const [mode, setMode] = React.useState<SidebarMode>(() => storedSidebarMode() ?? (isMobile ? "Hidden" : "Wide"));

    // Southwind's Layout does exactly this, in an effect on [isMobile]: CROSSING the breakpoint re-decides
    // the mode — hidden on mobile, and back to the stored desktop choice on the way out. Without it the mode
    // is only ever decided on the first render, so a window that starts narrow (or a phone rotated to
    // landscape) keeps a hidden sidebar after there is room for it, until you toggle it by hand.
    React.useEffect(() => {
        setMode(isMobile ? "Hidden" : storedSidebarMode() ?? "Wide");
    }, [isMobile]);

    // What is REMEMBERED is the desktop preference, as in Southwind (it writes the key only when !isMobile):
    // hiding the sidebar because the window got narrow must not overwrite the choice made when it was wide.
    return [mode, (m: SidebarMode) => {
        if (!isMobile)
            localStorage.setItem(SIDEBAR_MODE_KEY, m);
        setMode(m);
    }];
}

export default function Layout(): React.JSX.Element {
    const location = useLocation();
    useRerenderOnUserChange();

    const isMobile = useBreakpoint() <= Breakpoints.sm;
    const [sidebarMode, setSidebarMode] = useSidebarMode(isMobile);

    // NO login guard here, exactly as in Southwind's Layout. Client-side authorization is expressed by
    // which routes EXIST: MainPublic only calls `startFull` for a real (non-anonymous) user, so an admin
    // path an anonymous visitor types falls through to NotFound and never renders. The real enforcement is
    // the server's role rules — the Anonymous role may read Category and Product and nothing else.
    const isAuthRoute = location.pathname.startsWith("/auth");

    // The sidebar only exists for a logged-in user (the /api/toolbar route answers per role) and never on the
    // login pages.
    const showSidebar = AppContext.currentUser != null && !isAuthRoute && sidebarMode !== "Hidden";

    return (
        // Southwind's #site-content: the shell OWNS the viewport height (see site.css .sf-app-shell), so
        // the document itself never scrolls — the sidebar and the page each scroll on their own.
        // `data-sidebar` is what lets the navbar's leading block be exactly as wide as the sidebar column
        // below it, so the omnibox starts where the page content starts — see site.css .sf-navbar-lead.
        // "hidden" covers every case with no sidebar at all (logged out, the /auth pages), not just the mode.
        <div className="sf-app-shell" data-sidebar={showSidebar ? sidebarMode.toLowerCase() : "hidden"}>
            {/* Southwind's `main-toolbar navbar navbar-expand`, and the colour is NOT hardcoded any more.
                It used to be `navbar-dark bg-dark`, which is a fixed dark bar whatever the theme says — so
                the light theme had a dark navbar over a white page. `bg-body` is a THEME VARIABLE
                (--bs-body-bg), so the bar follows light / dark / auto and any bootswatch palette on its own,
                with no flash on load; `main-toolbar` brings Signum's border-bottom, which is what separates
                the bar from the page now that both are theme-coloured (the page container is
                --bs-tertiary-bg, a shade off --bs-body-bg). Southwind gets there by having ThemeModeSelector
                call back into `onSetMode` and toggle bg-dark / bg-light by hand; a variable needs no
                callback, and cannot be missed by a palette that changes the theme without the mode. */}
            <nav className="main-toolbar navbar navbar-expand bg-body ps-0 pe-3 flex-shrink-0">
                {/* The toggle + the wordmark are ONE block, because together they stand over the sidebar:
                    site.css gives it the sidebar's own width so the omnibox lines up with the page content.
                    The left inset moved off the nav (`px-3` → `ps-0 pe-3`) and into this block, which is what
                    lets the block start at the viewport edge, exactly as the sidebar does. */}
                <div className="sf-navbar-lead">
                    {AppContext.currentUser && !isAuthRoute &&
                        <div className="navbar-nav">
                            <SidebarToggleItem isMobile={isMobile} mode={sidebarMode} setMode={setSidebarMode} />
                        </div>}
                    <Link className="navbar-brand" to="/">eastwind</Link>
                </div>
                {/* The omnibox (Southwind puts it in the navbar too). Only for a logged-in user: the
                    /api/omnibox route asserts OmniboxPermission.ViewOmnibox.
                    `me-3` and no left margin: its left edge IS the alignment, so nothing may sit before it. */}
                {AppContext.currentUser && <div className="sf-omnibox me-3"><OmniboxAutocomplete inputAttrs={{ className: "form-control form-control-sm" }} /></div>}
                <div className="navbar-nav ms-auto">
                    {/* The alerts BELL (Southwind puts <AlertDropdown/> in its navbar too): the unattended
                        count, and a panel of toasts that attends an alert when you close it. Renders nothing
                        for a user who may not view AlertEntity. */}
                    {AppContext.currentUser && <AlertDropdown />}
                    {/* The release-notes BULLHORN (Signum puts <WhatsNewDropdown/> in the same place): the
                        unread count, and a toast per news item that marks it read when you close it. Renders
                        nothing for a user who may not view WhatsNewEntity. */}
                    {AppContext.currentUser && <WhatsNewDropdown />}
                    {/* Language picker (Southwind's Layout has one too). Renders nothing unless the server
                        reports more than one culture with translations loaded. */}
                    <CultureDropdown isMobile={isMobile} />
                    {/* The two theme pickers, in Southwind's order: the PALETTE (bootswatch, or plain
                        bootstrap) and then light / dark / auto. Neither is passed an `onSetMode`: Southwind
                        needs that callback to recolour a navbar that declares no colour of its own, while
                        this one is painted by a theme VARIABLE (see the nav above) and bootstrap 5.3 reads
                        `data-bs-theme` off the root for everything below it. */}
                    <ThemeSelector />
                    <ThemeModeSelector />
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
                {/* Southwind's `<main id="maincontent" className="container-fluid overflow-auto pt-2">`, and
                    each part of that matters:
                     - a <main>, so Frames.css's `.sf-page-container > main` makes it a flex COLUMN that grows
                       — which is what lets a page's own `flexGrow: 1` fill the height (#hero relies on it);
                     - `overflow-auto`, so the PAGE scrolls here and not the document. It also gives the flex
                       item an automatic minimum size of 0 (a scroll container's does not floor at its
                       content), which is what allows it to shrink and scroll at all;
                     - PADDING, not the `mt-3` margin this used to carry: a margin above a scroll pane is
                       dead space that never scrolls away, and #hero's full-bleed has to cancel it (site.css).
                    tabIndex so the skip-link above can move focus here. */}
                <main tabIndex={-1} id="sf-main-content" className="container-fluid overflow-auto pt-3">
                    <ErrorBoundary deps={[location.pathname + location.search]}>
                        <Outlet />
                    </ErrorBoundary>
                </main>
            </SidebarContainer>
            <GlobalModalContainer />
            {/* The chatbot's floating button (Southwind's Layout lazy-imports it the same way). Only for a
                logged-in user: every skill it can reach reads the database as that user. */}
            {AppContext.currentUser &&
                <React.Suspense fallback={null}>
                    <ChatbotButton />
                </React.Suspense>}
            {/* The notification host (Signum's <Notify/>): registers the Notify singleton so ajax "loading"
                toasts and operation "success" toasts have somewhere to render. Must stay mounted app-wide. */}
            <Notify />
        </div>
    );
}
