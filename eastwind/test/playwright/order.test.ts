import "@altea/altea-playwright/LineProxies/index"; // registers every auto-line rule
import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { table } from "@altea/altea/server/table";
import { OrderEntity, OrderOperation } from "../../app/orders/Order.data";
import { PersonEntity, CustomerEntity } from "../../app/customers/Customer.data";
import { ProductEntity } from "../../app/products/Product.data";
import { browse, hasStack, TestUser } from "./setup";

// The point of this suite — and what
// separates it from test/logic/order.test.ts, which calls the same operations directly — is that the
// order is BUILT BY CLICKING: found through a search page, constructed from its customer, filled in line
// by line, and saved, exactly as a user would. Anything the UI wires wrongly fails here and nowhere else.
//
// Every page and modal is a SCOPE, and `.scoped(...)` runs a closure over it — the closure
// owns the thing, and leaving it closes the modal and waits for whatever opened it.
describe.skipIf(!hasStack)("OrderReactTest", () => {

    test("OrderWebTestExample", async () => {
        // Arranged through the domain, because the ASSERTION needs them, not the clicking: the suite
        // queries the same two rows the same way.
        const sonic = await table(ProductEntity).single(p => p.productName.includes("Sonic"));
        const shipName = `Playwright ${Date.now()}`;

        // The browser belongs to this closure, and leaving it closes the browser however the test ends.
        //
        // SUPER rather than Standard — eastwind's AuthRules seed does not grant the
        // Standard role CreateOrderFromCustomer, so the construct button is simply not on the page for
        // it (test/logic/order.test.ts hits the same wall as an outright UnauthorizedAccessException).
        // Super has an EMPLOYEE linked too, which the operation needs to fill the order's employee.
        await browse(TestUser.Super, async b => {

            const lite = await b.searchPage(PersonEntity).scoped(async persons => {
                await persons.searchControl.search();
                // Ordered so row 1 is the same row every run — the search's default order is not a promise.
                await persons.results.orderBy(p => p.id);

                // Opened AS the customer base type: CreateOrderFromCustomer is declared From<CustomerEntity>
                // (eastwind has Person and Company under one customer), and the operation's own type is what
                // the frame has to agree with: PersonEntity, because that IS the customer type.
                return await persons.results.entityClickModal(1, CustomerEntity).scoped(async john => {
                    // `{ groupId: "create" }` names the operation group, and it is
                    // not decoration: construct-from operations live behind a "Create…" DROPDOWN, so the
                    // button does not exist in the DOM until that dropdown is opened.
                    return await john.constructFrom(OrderOperation.CreateOrderFromCustomer, OrderEntity, { groupId: "create" })
                        .scoped(async order => {
                            await order.lines.autoLine(o => o.shipName).setValueUntyped(shipName);
                            await order.lines.entityCombo(o => o.shipVia).selectLabel("FedEx");
                            // eastwind requires a freight and CreateOrderFromCustomer does not default
                            // one, so a user filling this form has to — and so does this test, or Save
                            // fails validation and the frame never comes back.
                            // test/logic/order.test.ts sets the same field for the same reason.
                            //
                            // loseFocus, and not optionally: a NumberLine formats and COMMITS on blur,
                            // so a value merely typed into it never reaches the entity and the field is
                            // still "not set" when Save validates.
                            await order.lines.number(o => o.freight).setValue(0, true);

                            // One row, one product — the table's own row container, so the line is created
                            // the way the button creates it.
                            // eastwind's order lines are a @part ROW table (OrderLineEntity), not an
                            // OrderDetailEmbedded — so createRow hands back the row's container directly
                            // rather than a scope to leave.
                            const line = await order.lines.entityTable(o => o.details).createRow();
                            await line.entityLine(d => d.product).setValue(sonic.toLite());

                            // The total is computed by the CLIENT as you type, before anything is saved —
                            // one unit of one product, so it is that product's price.
                            await waitTotalPrice(order, sonic.unitPrice.toString());

                            // Save waits for the frame to come back, which it never does if the entity
                            // is invalid — a timeout that says nothing about WHY. Ask the frame first,
                            // so a missing field is reported as the missing field.
                            await order.assertNoValidationErrors();

                            await order.execute(OrderOperation.Save);

                            // And still is after the round trip, now computed by the SERVER.
                            await waitTotalPrice(order, sonic.unitPrice.toString());

                            return await order.lite();
                        });
                });
            });

            assert.notEqual(lite, null);

            // Re-opened from its own URL, the saved order shows what the database holds — the last
            // thing worth checking, and the one that proves the write landed rather than just the screen.
            const saved = await table(OrderEntity).single(o => o.id == lite!.id);
            await b.framePage(lite!).scoped(async order => {
                await waitTotalPrice(order, saved.totalPrice().toString());
            });
        });
    });
});

/**
 * The total is a read-only input the client recomputes,
 * so the assertion is a WAIT on its value rather than a read: polling is what makes it independent of
 * how long the recompute takes.
 */
async function waitTotalPrice(order: { element: { locator(selector: string): { getAttribute(name: string): Promise<string | null> } } }, expected: string): Promise<void> {
    const input = order.element.locator("input.total-price");
    const deadline = Date.now() + 10_000;
    let last: string | null = null;
    while (Date.now() < deadline) {
        last = await input.getAttribute("value");
        if (last != null && Number(last) === Number(expected))
            return;
        await new Promise(r => setTimeout(r, 100));
    }
    assert.fail(`total-price stayed at ${JSON.stringify(last)}, expected ${JSON.stringify(expected)}`);
}
