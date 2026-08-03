import "@altea/altea/server";
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import { SchemaBuilder } from "@altea/altea/server/schema";
import { RegionEntity, TerritoryEntity, EmployeeEntity } from "./Employee.data";

// Port of Southwind's EmployeesLogic.Start. The EmployeeEntity_Territories junction (the territories
// MList) is pulled into the schema transitively via EmployeeEntity.territories.
export namespace EmployeesLogic {
    export function start(sb: SchemaBuilder): void {
        sb.include(RegionEntity).withQuery();
        sb.include(TerritoryEntity).withQuery();
        sb.include(EmployeeEntity).withQuery();
    }
}
