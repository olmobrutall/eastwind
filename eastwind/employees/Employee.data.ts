import { reflect, init } from "@altea/altea/data/reflection";
import { Entity } from "@altea/altea/data/entity";
import { Lite } from "@altea/altea/data/lite";
import { entity, quoted, backReference, valueField, fullTextIndex, vectorIndex, column } from "@altea/altea/data/decorators";
import { Temporal, type int, toInt } from "@altea/altea/data/basics";
import { Vector } from "@altea/altea/data/vector";
import type { ExecuteSymbol } from "@altea/altea/data/operations";
import { AddressEmbedded } from "../customers/Customer.data";

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
// Full-text index over FirstName + LastName + Notes (Southwind's EmployeesLogic:
// .WithFullTextIndex(a => new { a.FirstName, a.LastName, a.Notes })).
@fullTextIndex<EmployeeEntity>(a => [a.firstName, a.lastName, a.notes])
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

// One text chunk of an employee (a title sentence, or a note fragment) plus its embedding vector,
// for semantic / nearest-neighbour search (Southwind's EmployeePassageEntity). Populated from
// EmployeeEntity.notes by generatePassages in the loader; the 768-dim embedding is imported from
// passagesWithEmbeddings.json (mirroring Southwind's EmployeeLoader).
@entity("System", "Transactional")
@vectorIndex<EmployeePassageEntity>(a => a.embedding)
export class EmployeePassageEntity extends Entity {
    employee: Lite<EmployeeEntity>;
    isTitle: boolean;
    chunk: string;
    // pgvector / SQL Server VECTOR(768) column (Signum's [DbType(Size=768)] Vector? Embedding).
    @column({ pgDbType: "vector", sqlDbType: "vector", size: 768, nullable: true })
    embedding: Vector | null;
    index: int = toInt(0);
}
