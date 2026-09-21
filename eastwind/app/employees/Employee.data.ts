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

// The Employees domain. An employee's territories are owned junction rows (EmployeeEntity_Territory) —
// altea models every list of references as a part entity.

@entity("String", "Master")
export class RegionEntity extends Entity {
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
    @uniqueIndex
    @stringLengthValidator({ min: 3, max: 100 })
    description: string;
    @quoted toString(): string { return this.description; }
}

export namespace TerritoryOperation {
    export const Save: ExecuteSymbol<TerritoryEntity> = init();
}

@entity("Main", "Master")
// Full-text index over firstName + lastName + notes.
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

    // UNBOUNDED, which is why the Northwind notes (448 characters over nine rows) fit and a 200-character
    // column would not. `@stringLengthValidator` carries both halves, so the min travels with the size.
    @stringLengthValidator({ min: 3, multiLine: true })
    notes: string | null;
    reportsTo: Lite<EmployeeEntity> | null;
    @stringLengthValidator({ min: 3, max: 255 })
    photoPath: string | null;
    // A row in `files.file`, so the column is `photo_id` — not a FileEmbedded (bytes inline, the shape
    // CategoryEntity.picture keeps).
    //
    // DIVERGENCE: a full reference, not a `Lite`. The COLUMN is the same either way, and the view
    // renders the photo — so a lite would only force a second fetch. altea's file LINES do not bind a
    // lite either.
    // Loaded from terminal/northwind/image_photos (see northwindImages.ts).
    photo: FileEntity | null;
    // Owned junction rows.
    @noRepeatValidator()
    territories: EmployeeEntity_Territory[];

    @quoted toString(): string { return `${this.firstName} ${this.lastName}`; }

    /**
     * The employee behind the current login, off the "Employee" claim the UserEmployeeMixin fills (see
     * entityOverrides). Null for a user with no employee linked (System, Anonymous) and outside any login.
     *
     * It answers on BOTH TIERS, because the claim is filled on both and the ambient user is an injected
     * provider (`CurrentUser`, altea's data/security): the server resolves it from the request scope, the
     * client from the logged-in user.
     */
    static current(): Lite<EmployeeEntity> | null {
        return CurrentUser.claim<Lite<EmployeeEntity>>("Employee");
    }
}

// Junction rows for EmployeeEntity.territories.
@part
export class EmployeeEntity_Territory extends Entity {
    @backReference employee: Lite<EmployeeEntity>;
    @valueField territory: Lite<TerritoryEntity>;
}

export namespace EmployeeOperation {
    export const Save: ExecuteSymbol<EmployeeEntity> = init();
}

// One text chunk of an employee (a title sentence, or a note fragment) plus its embedding vector,
// for semantic / nearest-neighbour search. Populated from EmployeeEntity.notes by generatePassages in the
// loader; the 768-dim embedding is imported from passagesWithEmbeddings.json.
@entity("System", "Transactional")
@vectorIndex<EmployeePassageEntity>(a => a.embedding)
export class EmployeePassageEntity extends Entity {
    employee: Lite<EmployeeEntity>;
    isTitle: boolean;
    // A passage is free text split for embedding, so the 200-character default would truncate it (the
    // sample data already reaches 175).
    @stringLengthValidator({ max: MAX_SIZE })
    chunk: string;
    // pgvector / SQL Server VECTOR(768) column.
    @column({ pgDbType: "vector", sqlDbType: "vector", size: 768, nullable: true })
    embedding: Vector | null;
    index: int = toInt(0);
}

// One row per employee/territory pair, so an employee covering three territories appears three times. The
// source is the junction row and the employee is reached through its back reference. Named by its row
// model, whose clean name is the query key `EmployeesByTerritory`.
//
// `photo` is a LITE, where the entity holds a full FileEntity: a search result is a list, and a full
// reference would fetch every row's bytes to render a column that only needs a link.
@reflect
export class EmployeesByTerritoryRowModel extends ModelEntity {
    /** The row identity: what the SearchControl navigates to. */
    entity: Lite<EmployeeEntity>;
    id: int;
    firstName: string;
    lastName: string;
    birthDate: Temporal.PlainDate | null;
    photo: Lite<FileEntity> | null;
    territory: Lite<TerritoryEntity>;
}
