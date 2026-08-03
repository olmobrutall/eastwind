import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { PersonEntity, CompanyEntity, AddressEmbedded } from "./Customer.data";

// Customers domain client. CustomerEntity is abstract (@implementedBy Person/Company); the queries are
// the concrete PersonEntity / CompanyEntity. AddressEmbedded's view is registered so EntityDetail lines
// (on Order.shipAddress, Employee.address, Supplier.address) render it.
export namespace CustomersClient {
    export function start(cb: ClientBuilder): void {
        cb.configure(PersonEntity)
            .withView(() => import("./Person"))
            .withQuerySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.firstName),
                    token(a => a.lastName),
                    token(a => a.phone),
                ],
            }));

        cb.configure(CompanyEntity)
            .withView(() => import("./Company"))
            .withQuerySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.companyName),
                    token(a => a.contactName),
                    token(a => a.phone),
                ],
            }));

        cb.configure(AddressEmbedded)
            .withView(() => import("./Address"));
    }
}
