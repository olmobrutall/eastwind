import * as React from "react";
import * as AppContext from "@altea/altea/client/AppContext";
import { AuthClient } from "@altea/altea-auth/client/AuthClient";

// The landing page, which mostly decides where you actually belong:
//  • no user            → the ANONYMOUS shop window (publicApi/PublicCatalog.tsx);
//  • a user with a HOME DASHBOARD (the highest-priority standalone dashboard the current role may see)
//                       → that dashboard;
//  • otherwise          → the hero below.
// Re-rendered on login/logout because MainPublic remounts the tree on resetUI.
//
export default function Home(): React.JSX.Element | null {

    const [loaded, setLoaded] = React.useState(false);

    React.useEffect(() => {
        let cancelled = false;

        if (!AuthClient.currentUser()) {
            AppContext.navigate("/publicCatalog", { replace: true });
            return;
        }//AnonymousRedirect

        redirectToHomeDashboard(() => { if (!cancelled) setLoaded(true); });//Dashboard

        return () => { cancelled = true; };
    }, []);

    if (!loaded)
        return null;

    return (
        <div id="hero" style={{ background: "url(" + AppContext.toAbsoluteUrl("/background_dark.jpg") + ")", backgroundSize: "cover", flexGrow: 1 }}>
            <div className="hero-container">
                <h1 className="white">eastwind</h1>
                <h2 className="white mb-4">A demo application on the <a href="https://github.com/olmobrutall/altea" style={{ color: "#cae4ff" }} title="altea">altea</a> framework — over Microsoft's Northwind database</h2>
                {/* No "good places to start" list: the sidebar and the omnibox say that better than prose
                    can. What is left is the getting-started checklist — the part a developer cannot
                    discover by clicking. */}
                <div className="card shadow text-start" style={{ maxWidth: "min(48rem, 92vw)" }}>
                    <div className="card-body">
                        <h5 className="card-title">New to altea?</h5>
                        <p className="card-text">
                            altea is a TypeScript port of{" "}
                            <a href="https://github.com/signumsoftware/framework" className="card-link">Signum Framework</a>, so the{" "}
                            <a href="https://github.com/signumsoftware/docs" className="card-link">Signum docs</a> read true here.
                            Everything is reachable from the sidebar and from the omnibox in the navbar.
                        </p>
                        <p className="mb-1 fw-semibold">Before this becomes your app</p>
                        <ul className="ps-3 mb-0">
                            <li>Try a palette from the navbar's theme picker — it loads any{" "}
                                <a href="https://bootswatch.com">bootswatch</a> theme from their CDN. To BAKE one in, swap the{" "}
                                <code>bootstrap…/bootstrap.min.css</code> import in <code>main.client.ts</code> for that
                                theme's own build</li>
                            <li>Add a favicon to <code>public/</code> and a <code>&lt;link rel="icon"&gt;</code> to{" "}
                                <code>index.html</code> (consider{" "}
                                <a href="https://www.favicon-generator.org/">favicon-generator</a>); the pre-React loading
                                splash is inline in that file too</li>
                            <li>Replace <code>public/background_dark.jpg</code> and the <code>eastwind</code> wordmark in{" "}
                                <code>Layout.tsx</code></li>
                            <li>Set <code>AUTH_TOKEN_KEY</code> in <code>eastwind/.env.&lt;dialect&gt;</code> — the dev fallback
                                is public, and the server warns about it on every boot</li>
                            <li>Fill in this environment's settings row at{" "}
                                <code>/find/ApplicationConfiguration</code> — mail, chatbot, workflow, SMS and the three
                                directories all live on it</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}

// The dashboard module is reached through a DYNAMIC import: the home page must keep working when
// @altea/altea-dashboard isn't registered, and the dashboard chunk stays out of the initial bundle.
// `otherwise` is the "show the hero" continuation — taken when there is no home dashboard, and also when
// the module is absent or the user may not view dashboards.
function redirectToHomeDashboard(otherwise: () => void): void {
    void import("@altea/altea-dashboard/client/DashboardClient")
        .then(mod => mod.DashboardClient.home())
        .then(home => {
            // `replace` so the browser Back button leaves the app instead of bouncing off this redirect.
            if (home)
                AppContext.navigate(`/dashboard/${home.id}`, { replace: true });
            else
                otherwise();
        }, otherwise);
}//redirectToHomeDashboard
