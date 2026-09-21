import "@altea/altea/server"; // installs save()/toLite()
import * as fs from "node:fs";
import * as path from "node:path";
import { Connector } from "@altea/altea/server/connection/connector";
import { view, table } from "@altea/altea/server/table";
import { BulkInserter } from "@altea/altea/server/bulkInserter";
import { toInt } from "@altea/altea/data/basics";
import { Vector } from "@altea/altea/data/vector";
import { PasswordEncoding } from "@altea/altea/server/passwordEncoding";
import { RegionEntity, TerritoryEntity, EmployeeEntity, EmployeeEntity_Territory, EmployeePassageEntity } from "../../app/employees/Employee.data";
import { AddressEmbedded } from "../../app/customers/Customer.data";
import { RoleEntity } from "@altea/altea-auth/data/Role";
import { UserEntity, UserState } from "@altea/altea-auth/data/User";
import { UserEmployeeMixin } from "../../app/globals/UserEmployeeMixin.data";
import { Northwind, NwRegion, NwTerritory, NwEmployee, NwEmployeeTerritory } from "./northwindSchema";
import { NorthwindImages } from "./northwindImages";
import { FileEntity } from "@altea/altea-files/data/Files";
import { terminalFile } from "../terminalFile";

// Reads Northwind through IView classes under a second
// connector, and bulk-inserts eastwind entities preserving the Northwind ids (here `entity.id = id` +
// BulkInserter.bulkInsertTable). Because ids are preserved, FK targets (reportsTo, territory) are set
// inline with Type.newLite(id), and owned collections are inserted as a second bulkInsertTable
// (altea's bulkInsertTable is single-table — it does not cascade owned rows).
export namespace EmployeeLoader {
    export async function loadRegions(): Promise<void> {
        const regions = await Connector.withConnector(await Northwind.connector(), () => view(NwRegion).toArray());
        await BulkInserter.bulkInsert(regions.map(r => {
            const e = RegionEntity.create({ description: r.RegionDescription.trim() });
            e.id = r.RegionID;
            return e;
        }));
    }

    export async function loadTerritories(): Promise<void> {
        // The regions by id — TerritoryEntity.region
        // is a full RegionEntity reference (regions were inserted with their Northwind ids preserved).
        const regionDic = new Map((await table(RegionEntity).toArray()).map(r => [Number(r.id), r]));
        const territories = await Connector.withConnector(await Northwind.connector(), () => view(NwTerritory).toArray());
        const entities = territories.map(t => {
            const e = TerritoryEntity.create({
                region: regionDic.get(t.RegionID)!,
                description: t.TerritoryDescription.trim(),
            });
            e.id = toInt(parseInt(t.TerritoryID.trim()));
            return e;
        });

        // Suffix every duplicate description with " (Dup)".
        // NOT optional and not a nicety: `TerritoryEntity.description` is `@uniqueIndex` (the entity declares
        // the same `[UniqueIndex]`), and Northwind's own data has TWO territories described "New York" —
        // zip 10019 and zip 10038, in both vendor scripts — so without this the load dies on
        // `uix_territory_description`. `duplicates` yields every element whose key was
        // ALREADY seen, so the first "New York" keeps its name and the second becomes "New York (Dup)".
        // Written out rather than added to altea's arrayExtensions: one consumer, and one line.
        const seen = new Set<string>();
        for (const e of entities) {
            if (seen.has(e.description))
                e.description += " (Dup)";
            else
                seen.add(e.description);
        }

        await BulkInserter.bulkInsert(entities);
    }

    export async function loadEmployees(): Promise<void> {
        const nwEmployees = await Connector.withConnector(await Northwind.connector(), () => view(NwEmployee).toArray());
        const nwEmpTerr = await Connector.withConnector(await Northwind.connector(), () => view(NwEmployeeTerritory).toArray());

        // Territories junction rows grouped by employee. The
        // employee back-reference is wired by bulkInsert's cascade — only the @valueField is set here.
        const terrByEmp = new Map<number, EmployeeEntity_Territory[]>();
        for (const et of nwEmpTerr) {
            const list = terrByEmp.get(et.EmployeeID) ?? [];
            list.push(EmployeeEntity_Territory.create({ territory: TerritoryEntity.newLite(toInt(parseInt(et.TerritoryID.trim()))) }));
            terrByEmp.set(et.EmployeeID, list);
        }

        // The photos are ROWS (files.file), and bulkInsert cascades owned COLLECTIONS but not
        // references — so they are saved first and the employees carry the saved entities. The upstream loader
        // gets away with a fat lite of an unsaved FileEntity because its BulkInsert walks the graph.
        const photoByEmployee = new Map<number, FileEntity>();
        for (const e of nwEmployees) {
            const photo = NorthwindImages.employeePhoto(e.FirstName, e.LastName);
            if (photo != null) {
                await photo.save();
                photoByEmployee.set(e.EmployeeID, photo);
            }
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
                // Northwind's own Employees.Photo is an OLE-wrapped bitmap — the column the
                // seed drops, so the photo comes off disk instead (northwindImages.ts).
                photo: photoByEmployee.get(e.EmployeeID) ?? null,
                territories: terrByEmp.get(e.EmployeeID) ?? [],
            });
            emp.id = e.EmployeeID;
            return emp;
        });
        // Bulk insert with identity disabled: preserved ids + the territories cascade.
        await BulkInserter.bulkInsert(employees);
    }

    // Chunk each
    // employee (a title sentence + their notes split on '\r' / '\n' / '.'), look each chunk's 768-dim
    // embedding up in passagesWithEmbeddings.json (a { chunkText: float[] } dictionary), and bulk-insert
    // the EmployeePassageEntity rows with their Vector embedding. Requires the employees to be loaded
    // first (step 3). If the embeddings file is absent the passages are still inserted, without vectors.
    export async function loadEmployeePassages(): Promise<void> {
        const dic = readEmbeddings();
        const employees = await table(EmployeeEntity).toArray();
        const passages = employees.flatMap(emp => generatePassages(emp, dic));
        if (dic != null) {
            const withEmbedding = passages.filter(p => p.embedding != null).length;
            console.log(`[passages] ${passages.length} passages, ${withEmbedding} matched an embedding in passagesWithEmbeddings.json.`);
        }
        await BulkInserter.bulkInsert(passages);
    }

    // The { chunkText: float[] } embeddings dictionary shipped alongside the loader
    // (passagesWithEmbeddings.json). Returns undefined (embeddings skipped) if the file is missing.
    function readEmbeddings(): Record<string, number[]> | undefined {
        const file = terminalFile("northwind", "passagesWithEmbeddings.json");
        if (!fs.existsSync(file)) {
            console.log(`[passages] ${path.basename(file)} not found — inserting passages without embeddings.`);
            return undefined;
        }
        return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, number[]>;
    }

    // A title chunk (index 0) plus one chunk per non-empty note fragment,
    // each assigned its embedding from the dictionary (looked up by the exact chunk text).
    function generatePassages(employee: EmployeeEntity, dic: Record<string, number[]> | undefined): EmployeePassageEntity[] {
        const title = (employee.title ?? "Employee");
        const titleChunk = (employee.titleOfCourtesy ?? "").trim().length > 0
            ? `${employee.titleOfCourtesy} ${employee.firstName} ${employee.lastName} works as ${title}`
            : `${employee.firstName} ${employee.lastName} works as ${title}`;

        const passages: EmployeePassageEntity[] = [
            EmployeePassageEntity.create({ employee: employee.toLite(), isTitle: true, chunk: titleChunk, index: toInt(0) }),
        ];

        if ((employee.notes ?? "").trim().length > 0) {
            const chunks = employee.notes!.split(/[\r\n.]/).map(t => t.trim()).filter(t => t.length > 0);
            chunks.forEach((chunk, i) =>
                passages.push(EmployeePassageEntity.create({ employee: employee.toLite(), isTitle: false, chunk, index: toInt(i) })));
        }

        if (dic != null)
            for (const p of passages) {
                const emb = dic[p.chunk];
                if (emb != null)
                    p.embedding = new Vector(emb);
            }

        return passages;
    }

    // One user per employee (UserName = FirstName,
    // password = FirstName), role by index over employees ordered by Notes length descending —
    // `i < 2 ? "Super user" : i < 5 ? "Advanced user" : "Standard user"`, each linked back to its employee
    // through the UserEmployeeMixin (see entityOverrides
    // employee.ToLite())`). Run AFTER loadEmployees and after the roles exist
    // (TypeScriptMigrations.createRoles). Idempotent: an existing username is left alone, except that a
    // user with no employee linked yet gets one (a database seeded before the mixin existed).
    export async function createUsers(): Promise<void> {
        const roles = new Map((await table(RoleEntity).toArray() as RoleEntity[]).map(r => [r.name, r]));
        const existing = new Map((await table(UserEntity).toArray() as UserEntity[]).map(u => [u.userName, u]));
        const employees = (await table(EmployeeEntity).toArray() as EmployeeEntity[])
            .sort((a, b) => (b.notes?.length ?? 0) - (a.notes?.length ?? 0));

        for (let i = 0; i < employees.length; i++) {
            const userName = employees[i].firstName;
            const employee = employees[i].toLite();

            // A user created before the mixin existed has no employee linked, and without one nothing it
            // creates can be stamped — so an existing row is TOPPED UP rather than skipped.
            const already = existing.get(userName);
            if (already != null) {
                if (already.mixin(UserEmployeeMixin).employee == null) {
                    already.mixin(UserEmployeeMixin).employee = employee;
                    await already.save();
                }
                continue;
            }

            const role = roles.get(i < 2 ? "Super user" : i < 5 ? "Advanced user" : "Standard user");
            if (role == null)
                continue;
            const user = UserEntity.create({
                userName,
                role: role.toLite(),
                state: UserState.Active,
                passwordHash: PasswordEncoding.hashPassword(userName, userName),
            });
            // altea inlines a mixin's fields onto the owner, so setting one is a plain assignment
            // through the typed `mixin()` cast.
            user.mixin(UserEmployeeMixin).employee = employee;
            await user.save();
        }
    }
}
