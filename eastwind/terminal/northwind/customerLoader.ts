import "@altea/altea/server";
import { Connector } from "@altea/altea/server/connection/connector";
import { view } from "@altea/altea/server/table";
import { BulkInserter } from "@altea/altea/server/bulkInserter";
import { CompanyEntity, PersonEntity, AddressEmbedded } from "../../app/customers/Customer.data";
import { Northwind, NwCustomer } from "./northwindSchema";

// Splits Northwind Customers by ContactTitle "Owner"
// into Person vs Company. Plain BulkInsert (identity ids — Orders link back by ContactName). The
// NOTE: the upstream loader filters with a SQL `.Where(...Contains)`;
// here the split is done in memory to avoid a nullable-string LIKE translation on the view read.
export namespace CustomerLoader {
    export async function loadCompanies(): Promise<void> {
        const customers = await Connector.withConnector(await Northwind.connector(), () => view(NwCustomer).toArray());
        const companies = customers.filter(c => !(c.ContactTitle ?? "").includes("Owner"));
        await BulkInserter.bulkInsert(companies.map(c => CompanyEntity.create({
            companyName: c.CompanyName,
            contactName: c.ContactName ?? "",
            contactTitle: c.ContactTitle ?? "",
            address: AddressEmbedded.create({
                address: c.Address ?? "",
                city: c.City ?? "",
                region: c.Region,
                postalCode: c.PostalCode,
                country: c.Country ?? "",
            }),
            phone: (c.Phone ?? "").replace(/\./g, " "),
            fax: c.Fax == null ? null : c.Fax.replace(/\./g, " "),
        })));
    }

    export async function loadPersons(): Promise<void> {
        const customers = await Connector.withConnector(await Northwind.connector(), () => view(NwCustomer).toArray());
        const persons = customers.filter(c => (c.ContactTitle ?? "").includes("Owner"));
        await BulkInserter.bulkInsert(persons.map(c => {
            const name = c.ContactName ?? c.CompanyName;
            const idx = name.lastIndexOf(" ");
            return PersonEntity.create({
                firstName: idx >= 0 ? name.substring(0, idx) : name,
                lastName: idx >= 0 ? name.substring(idx + 1) : name,
                dateOfBirth: null,
                title: null,
                address: AddressEmbedded.create({
                    address: c.Address ?? "",
                    city: c.City ?? "",
                    region: c.Region,
                    postalCode: c.PostalCode,
                    country: c.Country ?? "",
                }),
                phone: (c.Phone ?? "").replace(/\./g, " "),
                fax: c.Fax == null ? null : c.Fax.replace(/\./g, " "),
            });
        }));
    }
}
