import * as React from "react";
import type { RouteObject } from "react-router";
import { ajaxPost } from "@altea/altea/client/Services";
import { QueryString } from "@altea/altea/client/QueryString";
import { ImportComponent } from "@altea/altea/client/ImportComponent";
import type { RegisterUserModel } from "./RegisterUser.data";

// The PUBLIC (anonymous) routes and the two endpoints
// behind them. Called from MainPublic BEFORE the `isFull` branch, so the page exists for a visitor who has
// never logged in; the server half is PublicLogic.server.ts.
export namespace PublicClient {

    export function startPublic(routes: RouteObject[]): void {
        routes.push({
            path: "/registerUser/:reportsToEmployeeId?",
            element: <ImportComponent onImport={() => import("./RegisterUser")} />,
        });
    }

    export namespace API {
        export function getRegisterUser(reportsToEmployeeId: string | undefined): Promise<RegisterUserModel> {
            return ajaxPost({ url: "/api/getRegisterUser?" + QueryString.stringify({ reportsToEmployeeId }) }, null);
        }

        export function registerUser(model: RegisterUserModel): Promise<void> {
            return ajaxPost({ url: "/api/registerUser" }, model);
        }
    }
}
