import { table } from "@altea/altea/logic/table";
import { Order } from "../entities/orders";
import "./orders.logic"; // registers prototype navigation methods (lines())

console.log("Hi from my-app server");

var obj: { name: string } | undefined = undefined;

var richOrders = table(Order)
    .filter(o => o.lines().some(a => a.unitPrice > 100))
    .toArray();

var bigOrders = table(Order)
    .filter(o => o.amount > (obj?.name.length ?? 15))
    .toArray();

console.log(richOrders, bigOrders);
