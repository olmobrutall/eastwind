import "@altea/altea/server"; // installs save()/toLite()
import { Connector } from "@altea/altea/server/connection/connector";
import { view, table } from "@altea/altea/server/table";
import { BulkInserter } from "@altea/altea/server/bulkInserter";
import { toInt } from "@altea/altea/data/basics";
import { RegionEntity, TerritoryEntity, EmployeeEntity, EmployeeEntity_Territories } from "../employees/Employee.data";
import { AddressEmbedded } from "../customers/Customer.data";
import { Northwind, NwRegion, NwTerritory, NwEmployee, NwEmployeeTerritory } from "./northwindSchema";

// Port of Southwind.Terminal/EmployeeLoader.cs. Reads Northwind through IView classes under a second
// connector (Signum's Connector.Override(...).Using), and bulk-inserts eastwind entities preserving the
// Northwind ids (Signum's .SetId(id) + BulkInsert(disableIdentity:true) — here `entity.id = id` +
// BulkInserter.bulkInsertTable). Because ids are preserved, FK targets (reportsTo, territory) are set
// inline with Type.newLite(id), and owned collections are inserted as a second bulkInsertTable
// (altea's bulkInsertTable is single-table — it does not cascade owned rows the way Signum's does).
export namespace EmployeeLoader {
    export async function loadRegions(): Promise<void> {
        const regions = await Connector.withConnector(Northwind.connector(), () => view(NwRegion).toArray());
        await BulkInserter.bulkInsert(regions.map(r => {
            const e = RegionEntity.create({ description: r.RegionDescription.trim() });
            e.id = r.RegionID;
            return e;
        }));
    }

    export async function loadTerritories(): Promise<void> {
        // Signum's `regionDic = Database.RetrieveAll<RegionEntity>().ToDictionary(Id)` — TerritoryEntity.region
        // is a full RegionEntity reference (regions were inserted with their Northwind ids preserved).
        const regionDic = new Map((await table(RegionEntity).toArray()).map(r => [Number(r.id), r]));
        const territories = await Connector.withConnector(Northwind.connector(), () => view(NwTerritory).toArray());
        await BulkInserter.bulkInsert(territories.map(t => {
            const e = TerritoryEntity.create({
                region: regionDic.get(t.RegionID)!,
                description: t.TerritoryDescription.trim(),
            });
            e.id = toInt(parseInt(t.TerritoryID.trim()));
            return e;
        }));
    }

    export async function loadEmployees(): Promise<void> {
        const nwEmployees = await Connector.withConnector(Northwind.connector(), () => view(NwEmployee).toArray());
        const nwEmpTerr = await Connector.withConnector(Northwind.connector(), () => view(NwEmployeeTerritory).toArray());

        // Territories junction rows grouped by employee (Signum's MList<TerritoryEntity>). The
        // employee back-reference is wired by bulkInsert's cascade — only the @valueField is set here.
        const terrByEmp = new Map<number, EmployeeEntity_Territories[]>();
        for (const et of nwEmpTerr) {
            const list = terrByEmp.get(et.EmployeeID) ?? [];
            list.push(EmployeeEntity_Territories.create({ territory: TerritoryEntity.newLite(toInt(parseInt(et.TerritoryID.trim()))) }));
            terrByEmp.set(et.EmployeeID, list);
        }

        const employees = nwEmployees.map(e => {
            const emp = EmployeeEntity.create({
                lastName: e.LastName,
                firstName: e.FirstName,
                title: e.Title,
                titleOfCourtesy: e.TitleOfCourtesy,
                birthDate: e.BirthDate?.toPlainDate() ?? null,
                hireDate: e.HireDate?.toPlainDate() ?? null,
                address: AddressEmbedded.create({
                    address: e.Address ?? "", city: e.City ?? "", region: e.Region,
                    postalCode: e.PostalCode, country: e.Country ?? "",
                }),
                homePhone: e.HomePhone,
                extension: e.Extension,
                notes: e.Notes,
                // ids are preserved, so the self-reference resolves inline (no second SaveList pass).
                reportsTo: e.ReportsTo != null ? EmployeeEntity.newLite(e.ReportsTo) : null,
                photoPath: e.PhotoPath,
                territories: terrByEmp.get(e.EmployeeID) ?? [],
            });
            emp.id = e.EmployeeID;
            return emp;
        });
        // Signum's `.BulkInsert(disableIdentity:true)`: preserved ids + the territories MList cascade.
        await BulkInserter.bulkInsert(employees);
    }
}
