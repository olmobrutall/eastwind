import { Link, Outlet } from "react-router";
import { GlobalModalContainer } from "@altea/altea/client/Modals";

// The app shell (Southwind's Layout, minus auth/toolbar/omnibox for now): a top navbar + the routed
// page via <Outlet/>. MainPublic/MainAdmin split and the sidebar/omnibox land once auth is wired.
// GlobalModalContainer is the single host every modal (Navigator.view/MessageModal/SelectorModal…)
// renders into — without it openModal fails ("current is null"); Signum mounts it once at the root.
export default function Layout() {
    return (
        <div className="sf-page-container">
            <nav className="navbar navbar-expand navbar-dark bg-dark px-3">
                <Link className="navbar-brand" to="/">eastwind</Link>
            </nav>
            <div className="container-fluid mt-3">
                <Outlet />
            </div>
            <GlobalModalContainer />
        </div>
    );
}
