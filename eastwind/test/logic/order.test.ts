import { describe, test, beforeAll } from "vitest";
import assert from "node:assert/strict";
import { table } from "@altea/altea/server/table";
import { Decimal } from "@altea/altea/data/basics";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { UserHolder } from "@altea/altea/server/userHolder";
import { UserWithClaims } from "@altea/altea/data/security";
import { OrderEntity, OrderOperation } from "../../app/orders/Order.data";
import { PersonEntity } from "../../app/customers/Customer.data";
import { ProductEntity } from "../../app/products/Product.data";
import { EastwindEnvironment } from "../environment/eastwindEnvironment";
import { hasDb, startEngine } from "../environment/testDatabase";

// Port of Southwind.Test.Logic/OrderTest.cs — the DOMAIN half of the order story, with no browser
// anywhere. The React suite (test/playwright) drives the same operations by clicking; this one calls
// them directly, so a failure here is the application's, not the page's.
//
// Southwind's `using (Transaction.Test())` is `Transaction.noCommit` here: the writes happen and the
// body sees them, but nothing survives the test — which is why a test may create rows freely and never
// clean up, and why this suite does not need the snapshot restore the browser one does.
describe.skipIf(!hasDb)("OrderTest", () => {
    beforeAll(async () => { await startEngine(); });

    test("OrderTestExample", async () => {
        // Signum's `AuthLogic.UnsafeUserSession("Standard")`. Not decoration: CreateOrderFromCustomer
        // fills the order's employee from the ambient user's claim, and the row-level type conditions
        // gate on it — so arranging as nobody would take a different path than the UI does.
        await asSuper(async () => {
            await Transaction.noCommit(async () => {
                const john = await table(PersonEntity).single(p => p.firstName == "John");

                const order = await john.constructFrom(OrderOperation.CreateOrderFromCustomer);

                // eastwind requires a freight; Southwind defaults it. The value is irrelevant to what
                // this test asserts — the TOTAL is the lines — but the order will not save without one.
                order.freight = new Decimal(0);

                const sonic = await table(ProductEntity).single(p => p.productName.includes("Sonic"));

                await EastwindEnvironment.addLine(order, sonic.productName);

                const saved = await order.execute(OrderOperation.Save);

                // One line of one unit, so the order's total IS the product's price — the same assertion
                // Southwind makes, and the one the React suite watches the `total-price` input reach.
                assert.equal(saved.totalPrice().toString(), sonic.unitPrice.toString());
            });
        });
    });
});

/** The seeded user the order story runs as. */
async function asSuper<R>(fn: () => Promise<R>): Promise<R> {
    const user = await EastwindEnvironment.user("Super");
    return await UserHolder.withUser(new UserWithClaims(user), fn);
}
