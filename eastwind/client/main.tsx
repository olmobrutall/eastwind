import "bootstrap/dist/css/bootstrap.min.css";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, type RouteObject } from "react-router";
import { Navigator } from "@altea/altea/client/Navigator";
import { Finder } from "@altea/altea/client/Finder";
import { Operations } from "@altea/altea/client/Operations";
import { loadReflectionMetadata } from "@altea/altea/client/ReflectionClient";
import { EntityOverrides } from "eastwind/entities/entityOverrides";
import Layout from "./Layout";
import Home from "./Home";
import NotFound from "./NotFound";

// Import every entity module for its side-effect registration (the transformer appends registerType so
// resolveType / getTypeInfo resolve on the client — needed to map operations to their type and to build
// queries/views). Mirrors Signum's entity *Client modules being imported by MainAdmin.
import "eastwind/entities/employees";
import "eastwind/entities/products";
import "eastwind/entities/shippers";
import "eastwind/entities/customers";
import "eastwind/entities/orders";

// eastwind SPA bootstrap (Southwind's MainPublic/MainAdmin, minus auth + extensions). Apply the shared
// EntityOverrides, load reflection metadata, start the framework client modules (each pushes its routes),
// then mount a react-router data router.
async function boot(): Promise<void> {
    EntityOverrides.start();
    await loadReflectionMetadata();

    const routes: RouteObject[] = [];
    Operations.start();
    Navigator.start({ routes });
    Finder.start({ routes });

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

void boot();
