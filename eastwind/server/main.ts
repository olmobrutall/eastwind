import { table } from "@altea/altea/server/table";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { OrderEntity, OrderState } from "../entities/orders";
import { ProductEntity } from "../entities/products";
import { EmployeesLogic } from "./employeesLogic";
import { ProductsLogic } from "./productsLogic";
import { ShippersLogic } from "./shippersLogic";
import { CustomersLogic } from "./customersLogic";
import { OrdersLogic } from "./ordersLogic";

console.log("Hi from eastwind server");

// Build the schema and register each module's queries/expressions (Southwind's *Logic.Start pattern).
const sb = new SchemaBuilder();
EmployeesLogic.start(sb);
ProductsLogic.start(sb);
ShippersLogic.start(sb);
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
