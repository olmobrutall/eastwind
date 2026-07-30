import "@altea/altea/server";
import { Connector } from "@altea/altea/server/connection/connector";
import { view, table } from "@altea/altea/server/table";
import { BulkInserter } from "@altea/altea/server/bulkInserter";
import { Temporal } from "@altea/altea/entities/basics";
import { OrderEntity, OrderLineEntity, OrderState } from "../entities/orders";
import { AddressEmbedded, CompanyEntity, PersonEntity, type CustomerEntity } from "../entities/customers";
import { EmployeeEntity } from "../entities/employees";
import { ProductEntity } from "../entities/products";
import { ShipperEntity } from "../entities/shippers";
import { Northwind, NwShipper, NwOrder, NwOrderDetail, NwCustomer } from "./northwindSchema";

// Port of Southwind.Terminal/OrderLoader.cs. Shippers preserve their Northwind ids; Orders preserve
// OrderID and link to customers by ContactName (customers have fresh identity ids). Order dates are
// rebased so the latest order is "yesterday", and the cancel rule (shipped && id % 7) applies —
// exactly like Southwind. SimulateOrderSystemTime is omitted (no system-versioning; extension-free).
export namespace OrderLoader {
    export async function loadShippers(): Promise<void> {
        const shippers = await Connector.withConnector(Northwind.connector(), () => view(NwShipper).toArray());
        await BulkInserter.bulkInsert(shippers.map(s => {
            const e = ShipperEntity.create({ companyName: s.CompanyName, phone: s.Phone ?? "" });
            e.id = s.ShipperID;
            return e;
        }));
    }

    export async function loadOrders(): Promise<void> {
        // Correlate Northwind CustomerID → ContactName → the persisted CustomerEntity (Signum's
        // `customers` dictionary keyed by ContactName / FirstName+LastName).
        const nwCustomers = await Connector.withConnector(Northwind.connector(), () => view(NwCustomer).toArray());
        const nameById = new Map(nwCustomers.map(c => [c.CustomerID, c.ContactName ?? c.CompanyName]));
        const custByName = new Map<string, CustomerEntity>();
        for (const c of await table(CompanyEntity).toArray()) custByName.set(c.contactName, c);
        for (const p of await table(PersonEntity).toArray()) custByName.set(`${p.firstName} ${p.lastName}`, p);

        const nwOrders = await Connector.withConnector(Northwind.connector(), () => view(NwOrder).toArray());
        const nwDetails = await Connector.withConnector(Northwind.connector(), () => view(NwOrderDetail).toArray());
        const detailsByOrder = new Map<number, NwOrderDetail[]>();
        for (const d of nwDetails) {
            const list = detailsByOrder.get(d.OrderID) ?? [];
            list.push(d);
            detailsByOrder.set(d.OrderID, list);
        }

        // Rebase dates: shift so the latest OrderDate lands on yesterday (Southwind's max.DaysTo(now)).
        const yesterday = Temporal.Now.plainDateISO().subtract({ days: 1 });
        let max: Temporal.PlainDate | null = null;
        for (const o of nwOrders) {
            const d = o.OrderDate?.toPlainDate();
            if (d != null && (max == null || Temporal.PlainDate.compare(d, max) > 0)) max = d;
        }
        const ts = max != null ? max.until(yesterday, { largestUnit: "day" }).days : 0;
        const shift = (d: Temporal.PlainDate | null): Temporal.PlainDate | null => d != null ? d.add({ days: ts }) : null;

        const orders = nwOrders.flatMap(o => {
            const name = o.CustomerID != null ? nameById.get(o.CustomerID) : undefined;
            const customer = name != null ? custByName.get(name) : undefined;
            if (customer == null || o.EmployeeID == null) return []; // skip orders missing a mapped customer/employee

            const orderDate = shift(o.OrderDate?.toPlainDate() ?? null) ?? Temporal.Now.plainDateISO();
            // OrderLine details (Signum's Details MList) — the order back-reference + @rowOrder are
            // wired by bulkInsert's cascade.
            const details = (detailsByOrder.get(o.OrderID) ?? []).map(d => OrderLineEntity.create({
                product: ProductEntity.newLite(d.ProductID),
                unitPrice: d.UnitPrice,
                quantity: d.Quantity,
                discount: d.Discount,
            }));
            const ord = OrderEntity.create({
                customer,
                employee: EmployeeEntity.newLite(o.EmployeeID),
                orderDate,
                requiredDate: shift(o.RequiredDate?.toPlainDate() ?? null) ?? orderDate,
                shippedDate: shift(o.ShippedDate?.toPlainDate() ?? null),
                cancelationDate: null,
                shipVia: o.ShipVia != null ? ShipperEntity.newLite(o.ShipVia) : null,
                shipName: o.ShipName,
                shipAddress: AddressEmbedded.create({
                    address: o.ShipAddress ?? "", city: o.ShipCity ?? "", region: o.ShipRegion,
                    postalCode: o.ShipPostalCode, country: o.ShipCountry ?? "",
                }),
                freight: o.Freight ?? 0,
                details,
                isLegacy: true,
                state: o.ShippedDate != null ? OrderState.Shipped : OrderState.Ordered,
            });
            ord.id = o.OrderID;
            // Southwind's cancel rule.
            if (ord.state === OrderState.Shipped && Number(ord.id) % 7 === 0) {
                ord.cancelationDate = ord.shippedDate;
                ord.state = OrderState.Canceled;
                ord.shippedDate = null;
            }
            return [ord];
        });
        // Signum's `.BulkInsert(disableIdentity:true)`: preserved OrderIDs + the details MList cascade.
        await BulkInserter.bulkInsert(orders);
    }
}
