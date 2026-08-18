import "@altea/altea/server";
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import "@altea/altea/server/operationFluentInclude"; // FluentInclude.withSave / withDelete
import { SchemaBuilder } from "@altea/altea/server/schema";
import { RegionEntity, TerritoryEntity, EmployeeEntity, EmployeePassageEntity, RegionOperation, TerritoryOperation, EmployeeOperation } from "./Employee.data";

// Port of Southwind's EmployeesLogic.Start. The EmployeeEntity_Territory junction (the territories
// MList) is pulled into the schema transitively via EmployeeEntity.territories.
export namespace EmployeesLogic {
    export function start(sb: SchemaBuilder): void {
        sb.include(RegionEntity).withSave(RegionOperation.Save).withQuery();
        sb.include(TerritoryEntity).withSave(TerritoryOperation.Save).withQuery();
        // Southwind's EmployeeOperation.Save passes an `execute` that regenerates the employee's search
        // passages when the DB supports vectors. In eastwind that passage generation lives in the
        // terminal loader (employeeLoader.loadEmployeePassages), so the Save here is a plain save.
        sb.include(EmployeeEntity).withSave(EmployeeOperation.Save).withQuery();
        sb.include(EmployeePassageEntity).withQuery();
    }
}
