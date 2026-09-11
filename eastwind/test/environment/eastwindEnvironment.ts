import { table } from "@altea/altea/server/table";
import { Decimal, toInt, toShort } from "@altea/altea/data/basics";
import { UserEntity, UserState } from "@altea/altea-auth/data/User";
import { RoleEntity } from "@altea/altea-auth/data/Role";
import { PasswordEncoding } from "@altea/altea/server/passwordEncoding";
import { CorruptMixin } from "@altea/altea/data/corruptMixin";
import { RegionEntity, TerritoryEntity, EmployeeEntity, EmployeeEntity_Territory } from "../../employees/Employee.data";
import { UserEmployeeMixin } from "../../globals/UserEmployeeMixin.data";
import { AddressEmbedded, PersonEntity, CompanyEntity } from "../../customers/Customer.data";
import { SupplierEntity, CategoryEntity, ProductEntity } from "../../products/Product.data";
import { ShipperEntity } from "../../shippers/Shipper.data";
import { OrderEntity, OrderLineEntity } from "../../orders/Order.data";

// Port of Southwind.Test.Environment/SouthwindEnvironment.cs — the data a TEST database is seeded with,
// which is deliberately NOT what the terminal loads.
//
// The terminal's `ts` migrations import the whole Northwind database: ~830 orders over 91 customers,
// the shape a demo or a production rehearsal wants. A test wants the opposite — a handful of rows it can
// name in an assertion, the same on every machine — so this file seeds three employees, five users, two
// products, three customers and one shipper, and nothing else. What the two DO share is the schema, the
// AuthRules.xml roles/rules and the UserAssets.xml dashboards: those are the application, not its data.
//
// Every step is idempotent, so a half-finished generation can be re-run.
export namespace EastwindEnvironment {

    /** Southwind's `LoadEmployees`: one region, two territories, and the three employees users map to. */
    export async function loadEmployees(): Promise<void> {
        if (await table(EmployeeEntity).count() > 0)
            return;

        const america = RegionEntity.create({ description: "America" });
        await america.save();

        const east = TerritoryEntity.create({ region: america, description: "East coast" });
        await east.save();
        const west = TerritoryEntity.create({ region: america, description: "South coast" });
        await west.save();

        const superUser = EmployeeEntity.create({
            firstName: "Super",
            lastName: "User",
            address: address(1),
            homePhone: phone(1),
            territories: [
                EmployeeEntity_Territory.create({ territory: east.toLite() }),
                EmployeeEntity_Territory.create({ territory: west.toLite() }),
            ],
        });
        await superUser.save();

        await EmployeeEntity.create({
            firstName: "Advanced",
            lastName: "User",
            address: address(2),
            homePhone: phone(2),
            territories: [EmployeeEntity_Territory.create({ territory: west.toLite() })],
            reportsTo: superUser.toLite(),
        }).save();

        await EmployeeEntity.create({
            firstName: "Standard",
            lastName: "User",
            address: address(3),
            homePhone: phone(4),
            territories: [EmployeeEntity_Territory.create({ territory: east.toLite() })],
            reportsTo: superUser.toLite(),
        }).save();
    }

    /**
     * Southwind's `LoadUsers`: one user per role, each with the name as its password (the dev seed's rule,
     * see eastwind's AGENTS.md) — so a browser test logs in as the role it wants to exercise.
     *
     * The employee link is what makes `Super` / `Advanced` / `Standard` usable for anything that reads
     * `EmployeeEntity.current()` — `OrderOperation.CreateOrderFromCustomer` does, so an order can only be
     * created as one of those three, never as `System`. Southwind links them the same way.
     */
    export async function loadUsers(): Promise<void> {
        const roles = new Map((await table(RoleEntity).toArray() as RoleEntity[]).map(r => [r.name, r]));
        const employees = new Map((await table(EmployeeEntity).toArray() as EmployeeEntity[])
            .map(e => [e.firstName, e.toLite()]));
        const existing = new Set((await table(UserEntity).toArray() as UserEntity[]).map(u => u.userName));

        const create = async (userName: string, roleName: string): Promise<void> => {
            if (existing.has(userName))
                return;
            const role = roles.get(roleName);
            if (role == null)
                throw new Error(`Role '${roleName}' does not exist — were the roles created before the users?`);

            const user = UserEntity.create({
                userName,
                role: role.toLite(),
                state: UserState.Active,
                passwordHash: PasswordEncoding.hashPassword(userName, userName),
            });
            user.mixin(UserEmployeeMixin).employee = employees.get(userName) ?? null;
            await user.save();
        };

        await create("System", "Super user");
        await create("Super", "Super user");
        await create("Advanced", "Advanced user");
        await create("Standard", "Standard user");
        await create("Anonymous", "Anonymous");
    }

    /** Southwind's `LoadProducts`: two suppliers, two categories, two products. */
    export async function loadProducts(): Promise<void> {
        if (await table(ProductEntity).count() > 0)
            return;

        const lego = SupplierEntity.create({
            companyName: "Lego Corp",
            contactName: "Billund",
            contactTitle: null,
            address: address(4),
            phone: phone(4),
            fax: phone(4),
            homePage: null,
        });
        await lego.save();

        const construction = CategoryEntity.create({
            categoryName: "Construction games",
            description: "Let your imagination create your toys",
            picture: null,
        });
        await construction.save();

        await ProductEntity.create({
            productName: "Lego Mindstorms EV3",
            category: construction.toLite(),
            supplier: lego.toLite(),
            quantityPerUnit: "1 Box",
            unitPrice: new Decimal("159.90"),
            reorderLevel: toInt(1),
            unitsInStock: toShort(10),
            discontinued: false,
            additionalInformation: [],
        }).save();

        const sega = SupplierEntity.create({
            companyName: "Sega Inc",
            contactName: "Kalinske",
            contactTitle: null,
            address: address(10),
            phone: phone(10),
            fax: phone(10),
            homePage: null,
        });
        await sega.save();

        const videoGames = CategoryEntity.create({
            categoryName: "Video games",
            description: "Enjoy virtual worlds and fabulous adventures",
            picture: null,
        });
        await videoGames.save();

        await ProductEntity.create({
            productName: "Sonic the Hedgehog",
            category: videoGames.toLite(),
            supplier: sega.toLite(),
            quantityPerUnit: "1 Case",
            unitPrice: new Decimal("49.90"),
            reorderLevel: toInt(2),
            unitsInStock: toShort(30),
            discontinued: false,
            additionalInformation: [],
        }).save();
    }

    /** Southwind's `LoadCustomers`: two persons (flagged corrupt, as Southwind does) and one company. */
    export async function loadCustomers(): Promise<void> {
        if (await table(PersonEntity).count() > 0 || await table(CompanyEntity).count() > 0)
            return;

        for (const [firstName, seed] of [["John", 5], ["Sara", 6]] as [string, number][]) {
            const person = PersonEntity.create({
                firstName,
                lastName: "Connor",
                title: null,
                dateOfBirth: null,
                phone: phone(seed),
                fax: null,
                address: address(seed),
            });
            // Southwind's `SetMixin((CorruptMixin c) => c.Corrupt, true)`: the imported customer that is
            // allowed to be incomplete.
            person.mixin(CorruptMixin).corrupt = true;
            await person.save();
        }

        await CompanyEntity.create({
            companyName: "Cyberdyne Systems Corporation",
            contactName: "Miles Dyson",
            contactTitle: "Dr.",
            phone: phone(7),
            fax: null,
            address: address(7),
        }).save();
    }

    /** Southwind's `LoadShippers`: the one shipper its test picks by label. */
    export async function loadShippers(): Promise<void> {
        if (await table(ShipperEntity).count() > 0)
            return;

        await ShipperEntity.create({ companyName: "FedEx", phone: phone(11) }).save();
    }

    // ---- Fixture helpers a test uses to arrange ------------------------------------------------------

    /**
     * Southwind's `SouthwindExtensions.AddLine(order, productName, …)` — append a line priced at the
     * product's current unit price. The product is looked up by a substring of its name, so a test says
     * `addLine(order, "Sonic")`.
     */
    export async function addLine(order: OrderEntity, productName: string, quantity = 1, discount = new Decimal(0)): Promise<OrderLineEntity> {
        const product = await table(ProductEntity).filter(p => p.productName.includes(productName)).single() as ProductEntity;

        const line = OrderLineEntity.create({
            product: product.toLite(),
            unitPrice: product.unitPrice,
            quantity: toInt(quantity),
            discount,
        });
        order.details.push(line);
        return line;
    }

    /** A seeded user, by name (the five {@link loadUsers} creates). */
    export async function user(userName: string): Promise<UserEntity> {
        const found = await table(UserEntity).filter(u => u.userName == userName).singleOrNull() as UserEntity | null;
        if (found == null)
            throw new Error(`No user '${userName}' — was the test environment generated? (pnpm --filter eastwind gen:environment <environment>)`);
        return found;
    }
}

// Southwind's `RandomAddress(seed)` / `RandomPhone(seed)`: made-up but STABLE values, so a test that
// asserts on one keeps passing. `new Random(seed)` is per-seed in C#; the same shape here is a tiny
// deterministic generator rather than Math.random.
function address(seed: number): AddressEmbedded {
    const next = random(seed);
    return AddressEmbedded.create({
        address: pick(next, ["Madison Av.", "Sessame Str.", "5th Av.", "Flamingo Way"]) + " " + Math.floor(next() * 100),
        city: pick(next, ["New York", "Los Angeles", "Miami", "Seattle"]),
        country: "USA",
        region: pick(next, ["NY", "FL", "WA", "CA"]),
        postalCode: digits(next, 5),
    });
}

function phone(seed: number): string {
    return digits(random(seed), 10);
}

/** mulberry32 — a seeded [0,1) generator, so every machine seeds the same rows. */
function random(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pick<T>(next: () => number, values: T[]): T {
    return values[Math.floor(next() * values.length)]!;
}

function digits(next: () => number, length: number): string {
    return Array.from({ length }, () => String(Math.floor(next() * 10))).join("");
}
