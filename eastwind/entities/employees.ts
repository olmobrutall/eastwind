import { reflect, init } from "@altea/altea/entities/reflection";
import { Entity } from "@altea/altea/entities/entity";
import { Lite } from "@altea/altea/entities/lite";
import { entity, quoted, backReference, valueField } from "@altea/altea/entities/decorators";
import { Temporal } from "@altea/altea/entities/basics";
import type { ExecuteSymbol } from "@altea/altea/entities/operations";
import { AddressEmbedded } from "./customers";

// Port of Southwind's Employees domain (Southwind/Employees/*.cs). Extension-free: EmployeeEntity's
// Photo (Signum.Files), the EmployeeLiteModel and Employee.Current (auth) are omitted; PhotoPath is
// kept as a plain string. Territories is an MList<TerritoryEntity> → the owned junction part entity
// EmployeeEntity_Territories (altea models every MList as a part entity, like music's BandEntity_Members).

@entity("String", "Master")
export class RegionEntity extends Entity {
    description: string;
    @quoted toString(): string { return this.description; }
}

export namespace RegionOperation {
    export const Save: ExecuteSymbol<RegionEntity> = init();
}

@entity("String", "Master")
export class TerritoryEntity extends Entity {
    region: RegionEntity;
    description: string;
    @quoted toString(): string { return this.description; }
}

export namespace TerritoryOperation {
    export const Save: ExecuteSymbol<TerritoryEntity> = init();
}

@entity("Main", "Master")
export class EmployeeEntity extends Entity {
    lastName: string;
    firstName: string;
    title: string | null;
    titleOfCourtesy: string | null;
    birthDate: Temporal.PlainDate | null;
    hireDate: Temporal.PlainDate | null;
    address: AddressEmbedded;
    homePhone: string | null;
    extension: string | null;
    notes: string | null;
    reportsTo: Lite<EmployeeEntity> | null;
    photoPath: string | null;
    // Signum's MList<TerritoryEntity> Territories → owned junction rows.
    territories: EmployeeEntity_Territories[];

    @quoted toString(): string { return `${this.firstName} ${this.lastName}`; }
}

// Junction rows for EmployeeEntity.territories (Signum's MList<TerritoryEntity>).
@entity("Part")
export class EmployeeEntity_Territories extends Entity {
    @backReference employee: Lite<EmployeeEntity>;
    @valueField territory: Lite<TerritoryEntity>;
}

export namespace EmployeeOperation {
    export const Save: ExecuteSymbol<EmployeeEntity> = init();
}
