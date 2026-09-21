import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { QuickLinkClient, QuickLinkLink } from "@altea/altea/client/QuickLinkClient";
import { toAbsoluteUrl } from "@altea/altea/client/AppContext";
import { EmployeeEntity } from "./Employee.data";
import { RegisterUserModel } from "../publicApi/RegisterUser.data";

// Employees domain client (also registers the Region/Territory types via the module import; those use
// the default first-5 columns).
export namespace EmployeesClient {
    export function start(cb: ClientBuilder): void {
        cb.configure(EmployeeEntity)
            .withView(() => import("./Employee"))
            .withQuerySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.firstName),
                    token(a => a.lastName),
                    token(a => a.title),
                ],
            }));

        // A quick link — "register somebody who reports to THIS employee". The
        // page it opens is ANONYMOUS (publicApi/RegisterUser.tsx), so the point of the link is the url an
        // employee copies out of it and hands to the new hire.
        QuickLinkClient.registerQuickLink(EmployeeEntity, new QuickLinkLink(
            RegisterUserModel.typeName,
            () => EmployeeEntity.niceName(),
            ctx => toAbsoluteUrl("/registerUser/" + ctx.lite.id),
            { icon: "user-plus", iconColor: "#93c54b" }));
    }
}
