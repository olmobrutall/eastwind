import { Finder } from "@altea/altea/client/Finder";
import { EmployeeEntity } from "eastwind/entities/employees";

// Employees domain client (also registers the Region/Territory types via the module import; those use
// the default first-5 columns).
export namespace EmployeesClient {
    export function start(): void {
        Finder.addSettings(
            EmployeeEntity.querySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.firstName),
                    token(a => a.lastName),
                    token(a => a.title),
                ],
            })),
        );
    }
}
