import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { EmployeeEntity } from "./Employee.data";

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
    }
}
