import { test, expect } from "@playwright/test";
import "@altea/altea-playwright/LineProxies/index"; // registers every auto-line rule
import { scoped } from "@altea/altea-playwright/PlaywrightExtensions";
import { OrderEntity } from "../orders/Order.data";
import { EastwindBrowser, testUser } from "./eastwindBrowser";

// The Southwind.Test.React counterpart (OrderReactTest.cs), in its style: every page / modal is a SCOPE, and
// `scoped(...)` is Signum's `Task.Then(async x => …)` — the closure owns the thing, and leaving it closes the
// modal and waits for whatever opened it. `await using` reads the same, for anyone who prefers it.
test.describe("Orders", () => {

    test("the search page lists orders and filters by ship name", async ({ page }) => {
        const browser = new EastwindBrowser(page);
        await browser.login(testUser.userName, testUser.password);

        await scoped(browser.searchPage("Order"), async search => {
            expect(await search.results.rowsCount()).toBeGreaterThan(0);

            // The columns are the ones OrderClient registers as defaults.
            expect(await search.results.columnTokens()).toContain("id");

            await search.searchControl.toggleFilters(true);
            await search.filters.addFilterFor("shipName", "Contains", "Ernst");
            await search.search();

            // Not "fewer rows than before": the page shows one PAGE of them either way, and shipName is not
            // a default column. The filter is proven by narrowing it to something that cannot match.
            expect(await search.results.rowsCount()).toBeGreaterThan(0);

            await search.filters.filterAt(0).setValue("no-such-ship-name-zzz");
            await search.search();
            expect(await search.results.rowsCount()).toBe(0);
        });
    });

    test("an order page reads and writes its lines", async ({ page }) => {
        const browser = new EastwindBrowser(page);
        await browser.login(testUser.userName, testUser.password);

        const id = await scoped(browser.searchPage("Order"), async search =>
            (await search.results.entityKeys())[0]!.split(";")[1]!);

        await scoped(browser.framePage<OrderEntity>(OrderEntity, "Order", id), async frame => {
            expect(await frame.entityInfo()).toMatchObject({ typeName: "Order", id });

            // A property LAMBDA addresses each line — the quote-transformer turns it into the
            // `data-property-path` the DOM carries.
            expect(await frame.lines.entityLine(o => o.customer).getEntityInfo()).not.toBeNull();
            await frame.lines.waitVisible(o => o.shipAddress.city); // a nested embedded resolves too

            // Write through the proxy and read it back (this is what `data-changes` makes deterministic).
            const shipName = frame.lines.textBox(o => o.shipName);
            await shipName.setValue("Playwright port");
            expect(await shipName.getValue()).toBe("Playwright port");

            // The save operation's button is there (we do NOT save: this order is demo data).
            expect(await frame.operationPresent("OrderOperation.Save")).toBe(true);
        });
    });

    test("a row opens in a modal scope that closes itself", async ({ page }) => {
        const browser = new EastwindBrowser(page);
        await browser.login(testUser.userName, testUser.password);

        await scoped(browser.searchPage("Order"), async search => {
            // Signum's `persons.Results.EntityClickAsync<PersonEntity>(1).Then(async john => { … })`.
            const shipName = await scoped(search.results.entityClickModal(0, OrderEntity), async order => {
                expect(await order.entityInfo()).not.toBeNull();
                return await order.lines.textBox(o => o.shipName).getValue();
            });

            expect(typeof shipName).toBe("string");

            // Leaving the scope closed the modal — the search is usable again.
            expect(await search.results.rowsCount()).toBeGreaterThan(0);
        });
    });
});
