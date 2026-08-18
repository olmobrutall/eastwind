import * as React from "react";
import { Link } from "react-router";
import * as AppContext from "@altea/altea/client/AppContext";
import { getDefinedQueries } from "@altea/altea/client/Reflection";

// Landing page. Port of Southwind's Home.tsx behaviour: if a HOME DASHBOARD exists (the highest-priority
// standalone dashboard the current role may see), redirect to it; otherwise fall back to eastwind's own
// content — links into the search page for each query the CURRENT ROLE can see. That list comes from the
// reflection blob (role-filtered server-side by TypeAuthLogic), so a limited role sees fewer queries.
// Re-rendered on login/logout because MainPublic remounts the tree on resetUI.
//
// The dashboard module is reached through a DYNAMIC import (as Signum does): the home page must keep working
// when @altea/altea-dashboard isn't registered, and the dashboard chunk stays out of the initial bundle.
export default function Home(): React.JSX.Element | null {

    const [loaded, setLoaded] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;

        import("@altea/altea-dashboard/client/DashboardClient")
            .then(mod => mod.DashboardClient.home())
            .then(home => {
                if (cancelled)
                    return;
                // `replace` so the browser Back button leaves the app instead of bouncing off this redirect.
                if (home)
                    AppContext.navigate(`/dashboard/${home.id}`, { replace: true });
                else
                    setLoaded(true);
            },
                // No dashboard module / not authorized for ViewDashboard → just show the query list.
                () => { if (!cancelled) setLoaded(true); });

        return () => { cancelled = true; };
    }, []);

    if (!loaded)
        return null;

    const queries = getDefinedQueries().sort((a, b) => a.localeCompare(b));
    return (
        <div>
            <h1 className="display-6">eastwind</h1>
            <p className="text-muted">Southwind ported onto the altea framework. Pick a query:</p>
            <ul className="list-unstyled">
                {queries.map(q => (
                    <li key={q} className="mb-1">
                        <Link to={`/find/${q}`}>{q}</Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
