import { Finder } from "@altea/altea/client/Finder";
import { PersonEntity, CompanyEntity } from "eastwind/entities/customers";

// Customers domain client. CustomerEntity is abstract (@implementedBy Person/Company); the queries are
// the concrete PersonEntity / CompanyEntity.
export namespace CustomersClient {
    export function start(): void {
        Finder.addSettings(
            PersonEntity.querySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.firstName),
                    token(a => a.lastName),
                    token(a => a.phone),
                ],
            })),
            CompanyEntity.querySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.companyName),
                    token(a => a.contactName),
                    token(a => a.phone),
                ],
            })),
        );
    }
}
