import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { library } from "@fortawesome/fontawesome-svg-core";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { far } from "@fortawesome/free-regular-svg-icons";
import { loadReflectionMetadata } from "@altea/altea/client/ReflectionClient";
import ErrorModal from "@altea/altea/client/Modals/ErrorModal";
import { EntityOverrides } from "./entityOverrides.data";
import Layout from "./Layout";
import Home from "./Home";
import NotFound from "./NotFound";

// Register the full free solid + regular icon sets so string-named icons resolve (Signum's
// MainPublic.tsx: library.add(fas, far)). Without this, <FontAwesomeIcon icon="save" /> and
// tuple forms like icon={["fas","layer-group"]} used across the client render nothing.
library.add(fas, far);

// Wire the global error / unhandled-rejection handlers to the ErrorModal (Southwind's MainPublic.tsx:
// `ErrorModal.register()`). Without this, an unhandled promise rejection — e.g. a failing
// parseFindOptions inside SearchControl's useAPI — is swallowed with only a console message, so the
// SearchModal renders empty instead of surfacing the error.
ErrorModal.register();

// eastwind SPA bootstrap (Southwind's MainPublic). Apply the shared EntityOverrides, register the full
// client via MainAdmin.startFull (which imports the entity clients → registers every entity type), THEN
// load the reflection metadata (translations + operations → TypeInfo + queries, which need the types
// registered first), and mount the router. No auth gating in eastwind — always full.
async function boot(): Promise<void> {
    EntityOverrides.start();

    const routes: RouteObject[] = [];
    (await import("./MainAdmin.client")).startFull(routes);

    await loadReflectionMetadata();

    const router = createBrowserRouter([{
        path: "/",
        element: <Layout />,
        children: [
            { index: true, element: <Home /> },
            ...routes,
            { path: "*", element: <NotFound /> },
        ],
    }]);

    const el = document.getElementById("root");
    if (el)
        createRoot(el).render(<RouterProvider router={router} />);
}

boot().catch(err => {
    console.error("[eastwind boot] failed:", err);
    const el = document.getElementById("root");
    if (el) el.textContent = "Boot failed: " + (err?.stack ?? err?.message ?? String(err));
});
