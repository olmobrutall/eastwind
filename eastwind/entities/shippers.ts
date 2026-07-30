import { Entity } from "@altea/altea/entities/entity";
import { entity, quoted } from "@altea/altea/entities/decorators";
import { reflect, init } from "@altea/altea/entities/reflection";
import type { ExecuteSymbol } from "@altea/altea/entities/operations";

// Port of Southwind's Shippers domain (Southwind/Shippers/ShipperEntity.cs).
@entity("Main", "Master")
export class ShipperEntity extends Entity {
    companyName: string;
    phone: string;
    @quoted toString(): string { return this.companyName; }
}

export namespace ShipperOperation {
    export const Save: ExecuteSymbol<ShipperEntity> = init();
}
