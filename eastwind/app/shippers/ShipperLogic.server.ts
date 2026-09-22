import "@altea/altea/server";
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import "@altea/altea/server/fluentOperations"; // FluentInclude.withSave / withDelete
import "@altea/altea-cache/server/CacheLogic"; // FluentInclude.withCache
import { SchemaBuilder } from "@altea/altea/server/schema";
import { Query } from "@altea/altea/server/query";
import { withQuoted } from "@altea/altea/data/decorators";
import { table } from "@altea/altea/server/table";
import { ShipperEntity, ShipperOperation } from "./Shipper.data";
import { OrderEntity } from "../orders/Order.data";

// Query navigation (declared in Shipper.data.ts, implemented here — where `table(T)` lives).
ShipperEntity.prototype.orders = withQuoted(function (this: ShipperEntity): Query<OrderEntity> {
    return table(OrderEntity).filter(o => o.shipVia!.id == this.id);
});

// The shippers registration.
export namespace ShippersLogic {
    export function start(sb: SchemaBuilder): void {
        sb.include(ShipperEntity)
            // eastwind demonstrates altea-cache here: three rows,
            // read on every order, changed almost never — the textbook `EntityData.Master` cache. Every
            // `Database.retrieve(ShipperEntity, …)` and every completed Order.shipper reference is then
            // served from memory, and a save invalidates it (see CacheLogic).
            .withCache()
            .withSave(ShipperOperation.Save)
            .withExpressionTo(s => s.orders())
            .withQuery();
    }
}
