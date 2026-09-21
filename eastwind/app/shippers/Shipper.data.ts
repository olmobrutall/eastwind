import { stringLengthValidator } from "@altea/altea/data/validators";
import { Entity } from "@altea/altea/data/entity";
import { entity, quoted, uniqueIndex } from "@altea/altea/data/decorators";
import { init } from "@altea/altea/data/reflection";
import type { ExecuteSymbol } from "@altea/altea/data/operations";

// The Shippers domain.
@entity("Main", "Master")
export class ShipperEntity extends Entity {
    @uniqueIndex
    @stringLengthValidator({ min: 3, max: 100 })
    companyName: string;
    @stringLengthValidator({ min: 3, max: 24 })
    phone: string;
    @quoted toString(): string { return this.companyName; }
}

export namespace ShipperOperation {
    export const Save: ExecuteSymbol<ShipperEntity> = init();
}
