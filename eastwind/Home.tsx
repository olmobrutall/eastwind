import * as React from "react";
import * as AppContext from "@altea/altea/client/AppContext";
import { AuthClient } from "@altea/altea-auth/client/AuthClient";

// Port of Southwind's `Home.tsx` — the landing page, which mostly decides where you actually belong:
//  • no user            → the ANONYMOUS shop window (publicApi/PublicCatalog.tsx);
//  • a user with a HOME DASHBOARD (the highest-priority standalone dashboard the current role may see)
//                       → that dashboard;
//  • otherwise          → the hero below.
// Re-rendered on login/logout because MainPublic remounts the tree on resetUI.
//
// The dashboard module is reached through a DYNAMIC import (as Signum does): the home page must keep working
// when @altea/altea-dashboard isn't registered, and the dashboard chunk stays out of the initial bundle.
//
// Divergences from Southwind: no `logo.png` (Southwind's own branding — the app name is rendered as text
// instead), and the body is eastwind's "what this is" card rather than Southwind's Signum getting-started
// checklist, which is advice about a C# repository this port does not have.
export default function Home(): React.JSX.Element | null {

    const [loaded, setLoaded] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;

        if (!AuthClient.currentUser()) {
            AppContext.navigate("/publicCatalog", { replace: true });
            return;
        }

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
                // No dashboard module / not authorized for ViewDashboard → just show the hero.
                () => { if (!cancelled) setLoaded(true); });

        return () => { cancelled = true; };
    }, []);

    if (!loaded)
        return null;

    return (
        <div id="hero" style={{ background: "url(" + AppContext.toAbsoluteUrl("/background_dark.jpg") + ")", backgroundSize: "cover", flexGrow: 1 }}>
            <div className="hero-container">
                <h1 className="white">eastwind</h1>
                <h2 className="white">Southwind, the demo application of <a href="http://www.signumsoftware.com" style={{ color: "#cae4ff" }} title="Signum Software">Signum Software</a>, ported onto the altea framework — over Microsoft's Northwind database</h2>
                <div className="card shadow mt-3">
                    <div className="card-body">
                        <h5 className="card-title">New here?</h5>
                        <p className="card-text">
                            Everything is reachable from the SIDEBAR (the toolbar of the current role) and from the
                            OMNIBOX in the navbar — type a type name, a query or an entity id.
                        </p>
                        <div className="text-start">
                            <p>Good places to start:</p>
                            <ul>
                                <li>The public shop window at <code>/publicCatalog</code> — the one page that needs no login</li>
                                <li>Any search page at <code>/find/&lt;query&gt;</code>, e.g. <code>/find/Order</code></li>
                                <li><code>/view/ApplicationConfiguration</code> — this environment's single settings row</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
