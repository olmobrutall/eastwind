import { Link, Outlet } from "react-router";

// The app shell (Southwind's Layout, minus auth/toolbar/omnibox for now): a top navbar + the routed
// page via <Outlet/>. MainPublic/MainAdmin split and the sidebar/omnibox land once auth is wired.
export default function Layout() {
    return (
        <div className="sf-page-container">
            <nav className="navbar navbar-expand navbar-dark bg-dark px-3">
                <Link className="navbar-brand" to="/">eastwind</Link>
            </nav>
            <div className="container-fluid mt-3">
                <Outlet />
            </div>
        </div>
    );
}
