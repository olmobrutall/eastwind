import { table } from "@altea/altea/logic/table";
import { Order, OrderState, Product } from "../entities/orders";
import "./orders.logic"; // registers Product.lines() + the OrderGraph

console.log("Hi from eastwind server");

// A plain state filter (translatable) and a cross-entity nav via Product.lines().
var newOrders = table(Order)
    .filter(o => o.state == OrderState.New)
    .toArray();

var richProducts = table(Product)
    .filter(p => p.lines().some(l => l.unitPrice > 100).$v)
    .toArray();

console.log(newOrders, richProducts);
