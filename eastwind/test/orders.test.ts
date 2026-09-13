import "@altea/altea-playwright/LineProxies/index"; // registers every auto-line rule
import { QueryTokenString } from "@altea/altea/data/dynamicQuery/queryTokenString";
import { FilterOperation } from "@altea/altea/data/dynamicQueries";
import { Decimal } from "@altea/altea/data/basics";
import { table } from "@altea/altea/server/table";
import { Operations } from "@altea/altea/server/operationLogic";
import { OrderEntity, OrderState, OrderOperation } from "../orders/Order.data";
import { PersonEntity } from "../customers/Customer.data";
import { ShipperEntity } from "../shippers/Shipper.data";
import { EastwindEnvironment } from "./environment/eastwindEnvironment";
import { asUser, expect, test, TestUser } from "./fixtures";

// The Southwind.Test.React counterpart (OrderReactTest.cs), in its style: every page / modal is a SCOPE,
// and `.scoped(...)` is Signum's `Task.Then(async x => …)` — the closure owns the thing, and leaving it
// closes the modal and waits for whatever opened it. `await using` reads the same, for anyone who prefers
// it.
//
// The database is restored from the snapshot before each test (see fixtures.ts), so a test ARRANGES what
// it needs — here, its own order, through the same operation the UI's button runs — instead of hunting
// through the seed for a row that happens to fit.
test.describe("Orders", () => {

    test("the search page lists orders and filters by ship name", async ({ b }) => {
        await asUser(TestUser.Super, () => createOrder({ shipName: "Ernst Handel" }));
        await asUser(TestUser.Super, () => createOrder({ shipName: "Blauer See Delikatessen" }));

        await b.loginAs(TestUser.Super);

        await b.searchPage(OrderEntity).scoped(async search => {
            expect(await search.results.rowsCount()).toBe(2);

            // The columns are the ones OrderClient registers as defaults, behind the SearchControl's own
            // leading entity column. Naming them as lambdas pins the SET and the ORDER without spelling a
            // single token: `tokens` renders each one the way the client does (`TotalPrice`, not
            // `totalPrice`), which is what the header attribute carries.
            expect(await search.results.columnTokens()).toEqual(search.tokens(
                QueryTokenString.entity(),
                o => o.id, o => o.customer, o => o.employee, o => o.orderDate, o => o.state, o => o.totalPrice()));

            await search.searchControl.toggleFilters(true);
            await search.filters.addFilterFor(o => o.shipName, FilterOperation.Contains, "Ernst");
            await search.search();
            expect(await search.results.rowsCount()).toBe(1);

            await search.filters.filterAt(0).setValue("no-such-ship-name-zzz");
            await search.search();
            expect(await search.results.rowsCount()).toBe(0);
        });
    });

    test("an order page reads and writes its lines", async ({ b }) => {
        // OrderEntity carries a class-level `@isReadOnly` (Order.data.ts) that freezes an Ordered /
        // Shipped / Canceled order WHOLE. `shipAddress` is the one member that opts back out, and only for
        // `Ordered` — so an ORDERED order is the only place a write is possible at all, which is exactly
        // what this one is.
        const order = await asUser(TestUser.Super, () => createOrder({ shipName: "Ernst Handel" }));

        await b.loginAs(TestUser.Super);

        await b.framePage(order).scoped(async frame => {
            // `is`, not toEqual: a lite read off the page is THIN (type + id), and a deep compare would
            // touch the `entity` accessor, which throws for exactly that reason.
            expect((await frame.lite())?.is(order)).toBe(true);

            // A property LAMBDA addresses each line — the quote-transformer turns it into the
            // `data-property-path` the DOM carries. A nested embedded resolves by narrowing step by step,
            // because that attribute holds the line's OWN member (`city`), not the dotted route.
            expect(await frame.lines.entityLine(o => o.customer).getValue()).not.toBeNull();
            await frame.lines.waitVisible(o => o.shipAddress.city);

            // The class rule in action: the order is placed, so its own members are frozen …
            expect(await frame.lines.textBox(o => o.shipName).isReadonly()).toBe(true);

            // … while `shipAddress` opted back out — so write through the proxy and read it back (this is
            // what `data-changes` makes deterministic).
            const city = frame.lines.textBox(o => o.shipAddress.city);
            await city.setValue("Playwright port");
            expect(await city.getValue()).toBe("Playwright port");

            // The line the order was created with, through the table's own row container.
            expect(await frame.lines.entityTable(o => o.details).count()).toBe(1);

            // Save it, and check the write landed in the DATABASE — the whole point of a test that owns
            // both ends. `execute` waits for the frame to come back with the operation's result.
            await frame.execute(OrderOperation.Save);
        });

        const saved = await table(OrderEntity).filter(o => o.id == order.id).single() as OrderEntity;
        expect(saved.shipAddress.city).toBe("Playwright port");
    });

    test("a row opens in a modal scope that closes itself", async ({ b }) => {
        await asUser(TestUser.Super, () => createOrder({ shipName: "Ernst Handel" }));

        await b.loginAs(TestUser.Super);

        await b.searchPage(OrderEntity).scoped(async search => {
            // Signum's `persons.Results.EntityClickAsync<PersonEntity>(1).Then(async john => { … })` —
            // with no type argument, because the search page already knows what it lists.
            const shipName = await search.results.entityClickModal(0).scoped(async order => {
                expect(await order.lite()).not.toBeNull();
                // The proxy speaks ENUM VALUES; the DOM holds the number behind them.
                expect(await order.lines.enumLine(o => o.state).getValue()).toBe(OrderState.Ordered);
                return await order.lines.textBox(o => o.shipName).getValue();
            });

            expect(shipName).toBe("Ernst Handel");

            // Leaving the scope closed the modal — the search is usable again.
            expect(await search.results.rowsCount()).toBe(1);
        });
    });
});

/**
 * One placed order for the Connor person, shipped by FedEx, with a Sonic line — Southwind's test builds
 * the same order by clicking, which is what the third test does; the other two only need it to EXIST.
 *
 * It goes through `OrderOperation.CreateOrderFromCustomer` (which is where the employee comes from — hence
 * the `asUser` around every call) and then `Save`, so the row is exactly what the button would have made.
 */
async function createOrder(values: { shipName: string }): Promise<OrderEntity> {
    const customer = await table(PersonEntity).filter(p => p.firstName == "John").single() as PersonEntity;
    const shipper = await table(ShipperEntity).single() as ShipperEntity;

    const order = await Operations.constructFrom(customer, OrderOperation.CreateOrderFromCustomer);
    order.shipName = values.shipName;
    order.shipVia = shipper.toLite();
    order.freight = new Decimal(0);
    await EastwindEnvironment.addLine(order, "Sonic");

    // Save is what places it: New → Ordered, stamping the order date (OrderLogic's state machine).
    return await Operations.execute(order, OrderOperation.Save);
}
