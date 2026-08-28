import * as React from "react";
import { Link } from "react-router";
import * as AppContext from "@altea/altea/client/AppContext";

// Port of Southwind's NotFound.tsx. It is the `path: "*"` route, so it catches BOTH a genuinely unknown url
// and — while logged out — every ADMIN url, because MainPublic only builds the admin routes once a user is
// authenticated (see its `reload`). So a deep link into the app that arrives without a session lands here.
//
// Hence the redirect: an anonymous visitor is sent to the login page carrying WHERE THEY WERE TRYING TO GO
// in the router state, and `AuthClient.Options.onLogin` (MainPublic.client) navigates back to it once the
// routes for it exist. `replace: true` so the back button does not bounce them into this page again.
export default function NotFound(): React.JSX.Element {

    React.useEffect(() => {
        if (AppContext.currentUser == null)
            AppContext.navigate("/auth/login", { state: { back: AppContext.location() }, replace: true });
    }, []);

    return (
        <div>
            <h3>Page not found</h3>
            <Link to="/">Back home</Link>
        </div>
    );
}
