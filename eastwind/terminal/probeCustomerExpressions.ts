// DB-free check of Southwind's three `CustomerEntity` expression registrations (CustomersLogic.cs
// 88-90). A polymorphic `Lite<CustomerEntity>` offers only its casts, so `Customer.Address.Country` —
// the token Southwind's "Customers" chart stores — resolves ONLY because the member is registered as
// an expression on the abstract base. Run with:
//   node --import @altea/altea/register.mjs dist/terminal/probeCustomerExpressions.js
import "@altea/altea/server/dynamicQuery/tokenExpressions";
import { RootToken } from "@altea/altea/data/dynamicQuery/tokens/rootToken";
import { SubTokensOptions, type QueryToken } from "@altea/altea/data/dynamicQuery/tokens/queryToken";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import { OrderEntity } from "../orders/Order.data";
import { CustomerEntity, PersonEntity, CompanyEntity } from "../customers/Customer.data";

const O = SubTokensOptions.CanElement | SubTokensOptions.CanAnyAll;
const customer = (): QueryToken => new RootToken(OrderEntity).subToken("Customer", O)!;

let bad = 0;
function check(name: string, actual: unknown, expected: unknown): void {
    const ok = actual === expected;
    if (!ok) bad++;
    console.log(`${ok ? "ok  " : "FAIL"}  ${name}: ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
}

console.log("before registering:", customer().subTokens(O).map(t => t.key).join(", "));
check("a declared member of the abstract base is NOT offered", customer().subToken("Address", O), undefined);
check("…it is reached by casting", customer().subToken("(Company)", O)!.subToken("Address", O)!.fullKey(),
    "Customer.(Company).Address");

// Exactly what CustomersLogic.start registers.
QueryLogic.expressions.register(CustomerEntity, (c: CustomerEntity) => c.address,
    { key: "Address", niceName: () => CustomerEntity.nicePropertyName(c => c.address) });
QueryLogic.expressions.register(CustomerEntity, (c: CustomerEntity) => c.phone,
    { key: "Phone", niceName: () => CustomerEntity.nicePropertyName(c => c.phone) });
QueryLogic.expressions.register(CustomerEntity, (c: CustomerEntity) => c.fax,
    { key: "Fax", niceName: () => CustomerEntity.nicePropertyName(c => c.fax) });

console.log("after registering: ", customer().subTokens(O).map(t => t.key).join(", "));
check("Address", customer().subToken("Address", O)?.fullKey(), "Customer.Address");
check("the stored chart's token", customer().subToken("Address", O)?.subToken("Country", O)?.fullKey(),
    "Customer.Address.Country");
check("Phone", customer().subToken("Phone", O)?.fullKey(), "Customer.Phone");
check("Fax", customer().subToken("Fax", O)?.fullKey(), "Customer.Fax");
check("the casts survive", customer().subToken("(Company)", O)?.fullKey(), "Customer.(Company)");
check("HasValue, which Signum's branch also ends in", customer().subToken("HasValue", O)?.fullKey(), "Customer.HasValue");
check("an unregistered member is still not offered", customer().subToken("Id", O), undefined);

// And a registration on the abstract base reaches every CONCRETE subclass's own query root, which is
// why `SMSOwnerData` needs one registration rather than one per customer type.
QueryLogic.expressions.register(CustomerEntity, (c: CustomerEntity) => c.smsOwnerData(),
    { key: "SMSOwnerData", niceName: () => CustomerEntity.nicePropertyName(c => c.smsOwnerData()) });
for (const t of [PersonEntity, CompanyEntity])
    check(`${(t as Function).name}'s root offers the base's SMSOwnerData`,
        new RootToken(t).subToken("SMSOwnerData", O)?.fullKey(), "SMSOwnerData");
check("…and so does the polymorphic reference", customer().subToken("SMSOwnerData", O)?.fullKey(),
    "Customer.SMSOwnerData");

console.log(bad === 0 ? "\nALL OK" : `\n${bad} FAILED`);
process.exitCode = bad === 0 ? 0 : 1;
