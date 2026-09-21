import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { Finder } from "@altea/altea/client/Finder";
import { PersonEntity, CompanyEntity, AddressEmbedded, CustomerRowModel } from "./Customer.data";

// Customers domain client. CustomerEntity is abstract (@implementedBy Person/Company); the queries are
// the concrete PersonEntity / CompanyEntity. AddressEmbedded's view is registered so EntityDetail lines
// (on Order.shipAddress, Employee.address, Supplier.address) render it.
export namespace CustomersClient {
    export function start(cb: ClientBuilder): void {
        cb.configure(PersonEntity)
            .withView(() => import("./Person"))
            .withQuerySettings(token => ({
                // altea sets the query's default display columns on the CLIENT (the server's
                // `withQuery()` is parameterless).
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
                // The company columns, on the client for the same reason as the person ones above.
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

        // The default filters on the union query (CustomerRowModel): the pinned "Search" box
        // (Finder.filterGroupSearch). Upstream searched each
        // concrete type's ToString; the union already projects that into the `name` column (Person →
        // "first last", Company → company name), so a single Contains over `name` is the faithful
        // equivalent. filterGroupSearch supplies the pinned label + `splitValue` (word-splits the text) +
        // `active: "WhenHasValue"`. The generic id+text
        // default filter skips ModelEntity projections, so this is the only search here.
        cb.configure(CustomerRowModel)
            .withQuerySettings(token => ({
                defaultFilters: [Finder.filterGroupSearch([
                    { token: token(a => a.name), operation: "Contains" },
                ])],
            }));
    }
}
