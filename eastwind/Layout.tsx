import { Link, Outlet, useLocation } from "react-router";
import { GlobalModalContainer } from "@altea/altea/client/Modals";
import { ErrorBoundary } from "@altea/altea/client/Components";

// The app shell (Southwind's Layout, minus auth/toolbar/omnibox for now): a top navbar + the routed
// page via <Outlet/>. MainPublic/MainAdmin split and the sidebar/omnibox land once auth is wired.
// GlobalModalContainer is the single host every modal (Navigator.view/MessageModal/SelectorModal…)
// renders into — without it openModal fails ("current is null"); Signum mounts it once at the root.
export default function Layout() {
    const location = useLocation();
    return (
        <div className="sf-page-container">
            <nav className="navbar navbar-expand navbar-dark bg-dark px-3">
                <Link className="navbar-brand" to="/">eastwind</Link>
            </nav>
            <div className="container-fluid mt-3">
                {/* Signum's Layout/ContainerToggle wraps the routed content in an ErrorBoundary. `deps` is the
                    reset key: on navigation it clears a stale render error so the next page renders (otherwise a
                    thrown page would stick). GlobalModalContainer stays OUTSIDE so modals survive a page error. */}
                <ErrorBoundary deps={[location.pathname + location.search]}>
                    <Outlet />
                </ErrorBoundary>
            </div>
            <GlobalModalContainer />
        </div>
    );
}
