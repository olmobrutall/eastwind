import "@altea/altea/server";
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import "@altea/altea/server/operationFluentInclude"; // FluentInclude.withSave / withDelete
import "@altea/altea-cache/server/CacheLogic"; // FluentInclude.withCache
import { SchemaBuilder } from "@altea/altea/server/schema";
import { ShipperEntity, ShipperOperation } from "./Shipper.data";

// Port of Southwind's ShippersLogic.Start.
export namespace ShippersLogic {
    export function start(sb: SchemaBuilder): void {
        sb.include(ShipperEntity)
            .withSave(ShipperOperation.Save)
            // eastwind demonstrates altea-cache here (Southwind does not use Signum.Caching): three rows,
            // read on every order, changed almost never — the textbook `EntityData.Master` cache. Every
            // `Database.retrieve(ShipperEntity, …)` and every completed Order.shipper reference is then
            // served from memory, and a save invalidates it (see CacheLogic).
            .withCache()
            .withQuery();
    }
}
