import "@altea/altea/server";
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import "@altea/altea/server/fluentOperations"; // FluentInclude.withSave / withDelete
import { SchemaBuilder } from "@altea/altea/server/schema";
import { table } from "@altea/altea/server/table";
import { type int } from "@altea/altea/data/basics";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import { AutoDynamicQueryCore } from "@altea/altea/server/dynamicQuery/dynamicQueryCore";
import { RegionEntity, TerritoryEntity, EmployeeEntity, EmployeePassageEntity, RegionOperation, TerritoryOperation, EmployeeOperation, EmployeeEntity_Territory, EmployeesByTerritoryRowModel } from "./Employee.data";

// The employees registration. The EmployeeEntity_Territory junction (the territories
// MList) is pulled into the schema transitively via EmployeeEntity.territories.
//
// The "Employee" claim filler is NOT here. altea
// builds a UserWithClaims on both tiers, so the filler is declared once in the app's entityOverrides (the
// data layer) and `EmployeeEntity.current()` reads it on either side.
export namespace EmployeesLogic {
    export function start(sb: SchemaBuilder): void {
        sb.include(RegionEntity)
            .withSave(RegionOperation.Save)
            .withQuery();
        sb.include(TerritoryEntity)
            .withSave(TerritoryOperation.Save)
            .withQuery();
        // The Save operation passes an `execute` that regenerates the employee's search
        // passages when the DB supports vectors. In eastwind that passage generation lives in the
        // terminal loader (employeeLoader.loadEmployeePassages), so the Save here is a plain save.
        // One row per employee/territory pair. The source is the junction row
        // and the employee comes through its back reference, which is the same join. A projection, so an
        // AutoDynamicQueryCore rather than `withQuery()`, named by its row model.
        QueryLogic.queries.register(EmployeesByTerritoryRowModel, () => new AutoDynamicQueryCore(() =>
            table(EmployeeEntity_Territory)
                .map(t => EmployeesByTerritoryRowModel.create({
                    entity: t.employee,
                    id: t.employee.id as int,
                    firstName: t.employee.entity.firstName,
                    lastName: t.employee.entity.lastName,
                    birthDate: t.employee.entity.birthDate,
                    photo: t.employee.entity.photo?.toLite() ?? null,
                    territory: t.territory,
                }))));

        sb.include(EmployeeEntity)
            .withSave(EmployeeOperation.Save)
            .withQuery();
        sb.include(EmployeePassageEntity).withQuery();
    }
}
