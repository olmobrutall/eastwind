import { reflect, init, MAX_SIZE } from "@altea/altea/data/reflection";
import { Entity, ModelEntity } from "@altea/altea/data/entity";
import { Lite } from "@altea/altea/data/lite";
import { CurrentUser } from "@altea/altea/data/security";
import {
    entity, part, quoted, backReference, valueField, fullTextIndex, vectorIndex, column, uniqueIndex,
} from "@altea/altea/data/decorators";
import { validate, stringLengthValidator, noRepeatValidator } from "@altea/altea/data/validators";
import { Temporal, type int, toInt } from "@altea/altea/data/basics";
import { Vector } from "@altea/altea/data/vector";
import type { ExecuteSymbol } from "@altea/altea/data/operations";
import { FileEntity } from "@altea/altea-files/data/Files";
import { AddressEmbedded } from "../customers/Customer.data";

// Port of Southwind's Employees domain (Southwind/Employees/*.cs). Extension-free: EmployeeEntity's
// Photo (Signum.Files) and the EmployeeLiteModel are omitted; PhotoPath is
// kept as a plain string. Territories is an MList<TerritoryEntity> → the owned junction part entity
// EmployeeEntity_Territory (altea models every MList as a part entity, like music's BandEntity_Member).

@entity("String", "Master")
export class RegionEntity extends Entity {
    // Southwind: `[UniqueIndex]` (Employees/RegionEntity.cs).
    @uniqueIndex
    @stringLengthValidator({ min: 3, max: 50 })
    description: string;
    @quoted toString(): string { return this.description; }
}

export namespace RegionOperation {
    export const Save: ExecuteSymbol<RegionEntity> = init();
}

@entity("String", "Master")
export class TerritoryEntity extends Entity {
    region: RegionEntity;
    // Southwind: `[UniqueIndex]` (Employees/TerritoryEntity.cs).
    @uniqueIndex
    @stringLengthValidator({ min: 3, max: 100 })
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
    @stringLengthValidator({ min: 3, max: 20 })
    lastName: string;
    @stringLengthValidator({ min: 3, max: 10 })
    firstName: string;
    // VALIDATION DEMO — a SERVER-ONLY rule (imagine it needs the DB / another aggregate). It returns null
    // in the "Client" phase, so the browser never runs it; the server first reports it after
    // deserialization (phase 2). Trigger: set Title to "!srv" and Save — the field goes red and the
    // summary shows, even though the client let the request through.
    @validate<EmployeeEntity>((e, _fi, env) =>
        env !== "Client" && e.title === "!srv" ? "Title '!srv' is reserved (server-only rule)" : null)
    @stringLengthValidator({ min: 3, max: 30 })
    title: string | null;
    @stringLengthValidator({ min: 3, max: 25 })
    titleOfCourtesy: string | null;
    birthDate: Temporal.PlainDate | null;
    hireDate: Temporal.PlainDate | null;
    address: AddressEmbedded;
    @stringLengthValidator({ min: 3, max: 25 })
    homePhone: string | null;
    // VALIDATION DEMO — a SAVE-ONLY rule: silent on the client AND after deserialization, enforced only in
    // the final "Saving" phase (e.g. a last-moment consistency check). Trigger: set Extension to "!save".
    @validate<EmployeeEntity>((e, _fi, env) =>
        env === "Saving" && e.extension === "!save" ? "Extension '!save' is rejected at save time" : null)
    @stringLengthValidator({ min: 3, max: 4 })
    extension: string | null;

    // Southwind's `[StringLengthValidator(Min = 3, MultiLine = true)]`. No Max means UNBOUNDED there —
    // Signum's `Max` defaults to -1 and `GetSqlSize` reads -1 as int.MaxValue — which is why the
    // Northwind notes (448 characters over nine rows) fit it and not a 200-character column.
    // `@stringLengthValidator` carries both halves, so the min travels with the size.
    @stringLengthValidator({ min: 3, multiLine: true })
    notes: string | null;
    reportsTo: Lite<EmployeeEntity> | null;
    @stringLengthValidator({ min: 3, max: 255 })
    photoPath: string | null;
    // Southwind's `Lite<FileEntity>? Photo` (Employees/EmployeeEntity.cs) — a row in `files.file`, so
    // the column is `photo_id`. It was a FileEmbedded here (bytes inline, the shape
    // CategoryEntity.picture keeps — Southwind's `Picture` is a FileEmbedded too) while altea had no
    // FileEntity; it has one now.
    //
    // DIVERGENCE: a full reference, not a `Lite`. The COLUMN is the same either way, and the view
    // renders the photo — so a lite would only force the second fetch Southwind makes by hand
    // (`Navigator.useFetchInState`). altea's file LINES do not bind a lite either.
    // Loaded from terminal/northwind/image_photos (see northwindImages.ts).
    photo: FileEntity | null;
    // Signum's MList<TerritoryEntity> Territories → owned junction rows.
    @noRepeatValidator()
    territories: EmployeeEntity_Territory[];

    @quoted toString(): string { return `${this.firstName} ${this.lastName}`; }

    /**
     * Southwind's `EmployeeEntity.Current` — the employee behind the current login, off the "Employee"
     * claim the UserEmployeeMixin fills (eastwind's entityOverrides). Null for a user with no employee
     * linked (System, Anonymous) and outside any login.
     *
     * Southwind's is server-only; this answers on BOTH TIERS, because the claim is filled on both and the
     * ambient user is an injected provider (`CurrentUser`, altea's data/security): the server resolves it
     * from the request scope, the client from the logged-in user.
     */
    static current(): Lite<EmployeeEntity> | null {
        return CurrentUser.claim<Lite<EmployeeEntity>>("Employee");
    }
}

// Junction rows for EmployeeEntity.territories (Signum's MList<TerritoryEntity>).
@part
export class EmployeeEntity_Territory extends Entity {
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
    // Southwind's `[StringLengthValidator(Max = int.MaxValue)]` — a passage is free text split for
    // embedding, so the 200-character default would truncate it (the sample data already reaches 175).
    @stringLengthValidator({ max: MAX_SIZE })
    chunk: string;
    // pgvector / SQL Server VECTOR(768) column (Signum's [DbType(Size=768)] Vector? Embedding).
    @column({ pgDbType: "vector", sqlDbType: "vector", size: 768, nullable: true })
    embedding: Vector | null;
    index: int = toInt(0);
}

// Southwind's `EmployeeQuery.EmployeesByTerritory` — one row per employee/territory pair, so an employee
// covering three territories appears three times. Signum flattens with `from t in e.Territories`; the
// source here is the junction row and the employee is reached through its back reference, which is the
// same join. Named by its row model, whose clean name is the query key `EmployeesByTerritory`.
//
// `photo` is a LITE, where the entity holds a full FileEntity: a search result is a list, and a full
// reference would fetch every row's bytes to render a column that only needs a link.
@reflect
export class EmployeesByTerritoryRowModel extends ModelEntity {
    /** Signum's `Entity = e`. */
    entity: Lite<EmployeeEntity>;
    id: int;
    firstName: string;
    lastName: string;
    birthDate: Temporal.PlainDate | null;
    photo: Lite<FileEntity> | null;
    territory: Lite<TerritoryEntity>;
}
