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
                // Mirrors Southwind's `Include<PersonEntity>().WithQuery(() => r => new { r.Id, r.FirstName,
                // r.LastName, r.DateOfBirth, r.Phone, r.Fax, r.Address })` — altea sets the query's default
                // display columns on the client (the server withQuery() is parameterless).
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.firstName),
                    token(a => a.lastName),
                    token(a => a.dateOfBirth),
                    token(a => a.phone),
                    token(a => a.fax),
                    token(a => a.address),
                ],
            }));

        cb.configure(CompanyEntity)
            .withView(() => import("./Company"))
            .withQuerySettings(token => ({
                // Mirrors Southwind's `Include<CompanyEntity>().WithQuery(() => r => new { r.Id, r.CompanyName,
                // r.ContactName, r.ContactTitle, r.Phone, r.Fax, r.Address })`.
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.companyName),
                    token(a => a.contactName),
                    token(a => a.contactTitle),
                    token(a => a.phone),
                    token(a => a.fax),
                    token(a => a.address),
                ],
            }));

        cb.configure(AddressEmbedded)
            .withView(() => import("./Address"));
    }
}
