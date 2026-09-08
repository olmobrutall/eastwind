import "@altea/altea/server"; // installs Entity.save()/delete()
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery"; // FluentInclude.withQuery
import { SchemaBuilder } from "@altea/altea/server/schema";
import { table } from "@altea/altea/server/table";
import type { Query } from "@altea/altea/server/query";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import { ManualDynamicQueryCore } from "@altea/altea/server/dynamicQuery/dynamicQueryCore";
import "@altea/altea/server/dynamicQuery/dQueryable"; // augments Query with .toDQueryable()
import "@altea/altea/server/fluentOperations"; // FluentInclude.withSave / withDelete
import { CustomerEntity, PersonEntity, CompanyEntity, CustomerRowModel, CustomerOperation } from "./Customer.data";
import { Graph } from "@altea/altea/server/graph";

// Port of Southwind's CustomersLogic.Start (Southwind/Customers/CustomersLogic.cs). The highlight is
// the MANUAL union query (Signum's DynamicQueryCore.Manual): a single "Customer" query whose rows are
// Person + Company projected to a common shape (CustomerRowModel) and concatenated in memory.
export namespace CustomersLogic {
    export function start(sb: SchemaBuilder): void {
        // The two concrete customer tables (each a plain WithQuery). CustomerEntity itself is abstract.
        sb.include(PersonEntity).withQuery();
        sb.include(CompanyEntity).withQuery();

        // Southwind's three registrations on the ABSTRACT base (CustomersLogic.cs):
        //   QueryLogic.Expressions.Register((CustomerEntity c) => c.Address) …Phone …Fax
        // A polymorphic `Lite<CustomerEntity>` (an order's `customer`) offers only its `(Company)` /
        // `(Person)` casts — that is Signum's rule and altea's — so the three members CustomerEntity
        // itself declares are reachable off it only because they are registered here. It is what makes
        // Southwind's stored `Customer.Address.Country` chart resolve, and the reason the app decides
        // which of a base's members are worth a column rather than the framework guessing.
        // Signum's `ForcePropertyRoute` has no counterpart: altea derives the route from the
        // expression's own Meta, which already lands on `(CustomerEntity).address`.
        QueryLogic.expressions.register(CustomerEntity, (c: CustomerEntity) => c.address,
            { key: "Address", niceName: () => CustomerEntity.nicePropertyName(c => c.address) });
        QueryLogic.expressions.register(CustomerEntity, (c: CustomerEntity) => c.phone,
            { key: "Phone", niceName: () => CustomerEntity.nicePropertyName(c => c.phone) });
        QueryLogic.expressions.register(CustomerEntity, (c: CustomerEntity) => c.fax,
            { key: "Fax", niceName: () => CustomerEntity.nicePropertyName(c => c.fax) });

        // The `SMSOwnerData` token a query-based SMSTemplate's `to` points at (see Customer.data.ts),
        // on the same abstract base for the same reason. This used to be registered once per CONCRETE
        // type, on the belief that a base registration is not offered on the subclasses — it is:
        // `getExtensionsTokens` walks the parent token's own prototype chain, so `Person`'s and
        // `Company`'s query roots both find it. One registration also puts it on the polymorphic
        // `Order.Customer`, which is a gain rather than a side effect (an SMS template over the Order
        // query can target the customer) and lowers like any other member of the base — the object it
        // returns becomes one CASE per field over the implementations.
        QueryLogic.expressions.register(CustomerEntity, (c: CustomerEntity) => c.smsOwnerData(),
            { key: "SMSOwnerData", niceName: () => CustomerEntity.nicePropertyName(c => c.smsOwnerData()) });

        // Southwind calls `.WithSave(CustomerOperation.Save)` on BOTH Person and Company. altea's operation
        // registry is keyed by the symbol alone (one implementation per symbol), so the shared Save is
        // registered ONCE — owned by the ABSTRACT base, which is what makes both concrete customers inherit
        // it (OperationLogic.operationsForType walks the prototype chain). `.withSave()` can't express this:
        // it owns the operation with the type it was included for, which would give Person the button and
        // leave Company without one.
        new Graph.Execute<CustomerEntity>(CustomerEntity, CustomerOperation.Save, {
            canBeNew: true,
            canBeModified: true,
            execute: () => { }, // the operation's implicit save persists it
        }).register();

        // Signum: `QueryLogic.Queries.Register(CustomerQuery.Customer, () => DynamicQueryCore.Manual(...))`.
        // altea registers a ManualDynamicQueryCore under the row-shape model (its query name). The
        // executor projects each source to CustomerRowModel, runs the request's filters/orders against
        // each (SQL-side), materialises them, concatenates, then orders + paginates in memory — exactly
        // Signum's `persons.Concat(companies).OrderBy(request.Orders).TryPaginate(request.Pagination)`.
        QueryLogic.queries.register(CustomerRowModel, () => new ManualDynamicQueryCore(CustomerRowModel, async (request) => {
            const columns = request.columns.map(c => c.token);

            // One source → a DEnumerable of CustomerRowModel rows: run the request's operations
            // (filter/order/select) SQL-side but WITHOUT pagination (forConcat), since we paginate the
            // combined result. Signum's `.ToDQueryable(descriptions).AllQueryOperationsAsync(request,
            // token, forConcat: true)`.
            const source = (query: Query<CustomerRowModel>) =>
                query.toDQueryable().allQueryOperationsAsync(request, /* forConcat */ true);

            const persons = await source(table(PersonEntity).map(p => CustomerRowModel.create({
                entity: p.toLite(),
                id: "P " + p.id,
                name: p.firstName + " " + p.lastName,
                address: p.address,
                phone: p.phone,
                fax: p.fax,
            })));

            const companies = await source(table(CompanyEntity).map(c => CustomerRowModel.create({
                entity: c.toLite(),
                id: "C " + c.id,
                name: c.companyName,
                address: c.address,
                phone: c.phone,
                fax: c.fax,
            })));

            return persons.concat(companies)
                .orderBy(request.orders)
                .tryPaginate(request.pagination)
                .toResultTable(columns, request.pagination);
        }));
    }
}
