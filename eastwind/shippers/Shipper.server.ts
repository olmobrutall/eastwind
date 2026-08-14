import "@altea/altea/server";
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import "@altea/altea/server/operationFluentInclude"; // FluentInclude.withSave / withDelete
import { SchemaBuilder } from "@altea/altea/server/schema";
import { ShipperEntity, ShipperOperation } from "./Shipper.data";

// Port of Southwind's ShippersLogic.Start.
export namespace ShippersLogic {
    export function start(sb: SchemaBuilder): void {
        sb.include(ShipperEntity)
            .withSave(ShipperOperation.Save)
            .withQuery();
    }
}
