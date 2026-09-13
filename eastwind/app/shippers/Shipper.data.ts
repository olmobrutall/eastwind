import { Entity } from "@altea/altea/data/entity";
import { entity, quoted, uniqueIndex } from "@altea/altea/data/decorators";
import { reflect, init } from "@altea/altea/data/reflection";
import type { ExecuteSymbol } from "@altea/altea/data/operations";

// Port of Southwind's Shippers domain (Southwind/Shippers/ShipperEntity.cs).
@entity("Main", "Master")
export class ShipperEntity extends Entity {
    // Southwind: `[UniqueIndex]` (Shippers/ShipperEntity.cs).
    @uniqueIndex
    companyName: string;
    phone: string;
    @quoted toString(): string { return this.companyName; }
}

export namespace ShipperOperation {
    export const Save: ExecuteSymbol<ShipperEntity> = init();
}
