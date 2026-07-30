import "@altea/altea/server";
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import { SchemaBuilder } from "@altea/altea/server/schema";
import { ShipperEntity } from "../entities/shippers";

// Port of Southwind's ShippersLogic.Start.
export namespace ShippersLogic {
    export function start(sb: SchemaBuilder): void {
        sb.include(ShipperEntity).withQuery();
    }
}
