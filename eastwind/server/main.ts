import { table } from "@altea/altea/server/table";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { OrderEntity, OrderState, ProductEntity } from "../entities/orders";
import { OrdersLogic } from "./ordersLogic"; // registers ProductEntity.lines() + the OrderGraph + queries
import { CustomersLogic } from "./customersLogic"; // Person/Company + the manual union Customer query

console.log("Hi from eastwind server");

// Build the schema and register each module's queries/expressions (Southwind's *Logic.Start pattern).
// Customers first: it includes the concrete Person/Company tables that OrderEntity.customer targets.
const sb = new SchemaBuilder();
CustomersLogic.start(sb);
OrdersLogic.start(sb);
sb.complete();

// A plain state filter (translatable) and a cross-entity nav via ProductEntity.lines().
var newOrders = table(OrderEntity)
    .filter(o => o.state == OrderState.New)
    .toArray();

var richProducts = table(ProductEntity)
    .filter(p => p.lines().some(l => l.unitPrice > 100).$v)
    .toArray();

console.log(newOrders, richProducts);
