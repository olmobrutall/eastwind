import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { loadReflectionMetadata } from "@altea/altea/client/ReflectionClient";
import { EntityOverrides } from "eastwind/entities/entityOverrides";
import Layout from "./Layout";
import Home from "./Home";
import NotFound from "./NotFound";

// eastwind SPA bootstrap (Southwind's MainPublic). Apply the shared EntityOverrides, register the full
// client via MainAdmin.startFull (which imports the entity clients → registers every entity type), THEN
// load the reflection metadata (translations + operations → TypeInfo + queries, which need the types
// registered first), and mount the router. No auth gating in eastwind — always full.
async function boot(): Promise<void> {
    EntityOverrides.start();

    const routes: RouteObject[] = [];
    (await import("./MainAdmin")).startFull(routes);

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
