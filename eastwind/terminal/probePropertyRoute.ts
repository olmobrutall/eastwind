// PropertyRouteEntity — the system table with one row per property route, and the five consumers that
// point at it (a property-authorization rule, a property's help, a tour's css step, a dynamic validation's
// sub-entity, a translated instance).
//
// What this pins is the part a unit test cannot see. The table is DERIVED and DEMAND-POPULATED: nothing
// seeds it, a row appears when a consumer first names that route, and the synchronizer prunes routes that
// no longer exist and rewrites paths that were renamed. So the things worth checking are the shape of the
// six tables (reading an existing Signum database is why this table was ported at all), that resolution
// really is idempotent — ask twice, get the same row, not a duplicate — that the serializer hook snaps a
// client-built route onto the persisted row, and that the delete cascades every consumer registers keep a
// route's removal from failing on a foreign key.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probePropertyRoute.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { Schema } from "@altea/altea/server/schema/schema";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { table } from "@altea/altea/server/table";
import { PropertyRoute, storedMemberName } from "@altea/altea/data/propertyRoute";
import { PropertyRouteEntity } from "@altea/altea/data/propertyRouteEntity";
import { PropertyRouteLogic, declaredLegacyRoutes } from "@altea/altea/server/propertyRouteLogic";
import { TimeSpanEmbedded } from "@altea/altea-workflow/data/WorkflowNodes";
import { SessionLogEntity } from "@altea/altea-auth/data/SessionLog";
import { ProductEntity, CategoryEntity } from "../products/Product.data";
import { Serializer } from "@altea/altea/data/serializer";
import { TypeEntity } from "@altea/altea/data/typeEntity";
import { RulePropertyEntity } from "@altea/altea-auth/data/Rules";
import { TypeHelpEntity_Property } from "@altea/altea-help/data/Help";
import { CssStepEntity } from "@altea/altea-tour/data/Tour";
import { DynamicValidationEntity } from "@altea/altea-dynamic/data/DynamicValidation";
import { TranslatedInstanceEntity } from "@altea/altea-translations/data/Translation";
import { OrderEntity } from "../orders/Order.data";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    // ---- the table -------------------------------------------------------------------------------
    // Signum's basics.PropertyRoute: Id, Path, RootType_id. NO Ticks ([TicksColumn(false)]).
    const t = Schema.current.table(PropertyRouteEntity);
    const name = t.name.toString().toLowerCase();
    check("table is basics.property_route", name.includes("property_route") && name.includes("basics"), name);

    const columns = Object.keys(t.columns).map(c => c.toLowerCase());
    for (const expected of ["id", "path", "root_type_id"])
        check(`column ${expected}`, columns.includes(expected), columns.join(", "));
    check("no ticks column (Signum's [TicksColumn(false)])", !columns.includes("ticks"), columns.join(", "));
    check("no column Signum does not have", columns.length === 3, columns.join(", "));

    // ---- the five consumers point at it, by Signum's own column names -----------------------------
    checkFk("auth.rule_property", RulePropertyEntity, "resource", "resource_id");
    checkFk("help.type_help_properties", TypeHelpEntity_Property, "property", "property_id");
    checkFk("tour css_step", CssStepEntity, "property", "property_id");
    checkFk("dynamic.dynamic_validation", DynamicValidationEntity, "subEntity", "sub_entity_id");
    checkFk("translation.translated_instance", TranslatedInstanceEntity, "propertyRoute", "property_route_id");

    // A route row carries its own root type, so a consumer must NOT repeat it.
    const tiColumns = Object.keys(Schema.current.table(TranslatedInstanceEntity).columns).map(c => c.toLowerCase());
    check("translated_instance has no redundant root_type_id", !tiColumns.includes("root_type_id"), tiColumns.join(", "));
    const rpColumns = Object.keys(Schema.current.table(RulePropertyEntity).columns).map(c => c.toLowerCase());
    check("rule_property has neither root_type_id nor path",
        !rpColumns.includes("root_type_id") && !rpColumns.includes("path"), rpColumns.join(", "));

    // ---- resolution ------------------------------------------------------------------------------
    const route = PropertyRoute.parse(OrderEntity, "shipAddress.city");
    check("the demo route parses", route.propertyString() === "shipAddress.city", route.propertyString());

    await ExecutionMode.global(async () => {
        // Not referenced yet ⇒ a NEW row (the table is demand-populated, never seeded).
        const fresh = await PropertyRouteLogic.toPropertyRouteEntity(route);
        check("an unreferenced route resolves to a NEW row", fresh.isNew);
        check("the new row carries the root type", fresh.rootType.cleanName === "Order", fresh.rootType.cleanName);
        check("and the path", fresh.path === "shipAddress.city", fresh.path);

        // The row is really COMMITTED, and deleted at the end. It cannot be done inside a rolled-back
        // transaction: both caches load in `Transaction.forceNew` (an independent transaction, so a
        // globalLazy reflects COMMITTED state only), which is exactly the behaviour under test — an
        // uncommitted row is invisible to them by design.
        try {
            await fresh.save();
            check("saving it makes it persisted", !fresh.isNew && fresh.id != null, String(fresh.id));

            // Idempotence is the whole point of the caches: ask again, get the SAME row.
            const again = await PropertyRouteLogic.toPropertyRouteEntity(route);
            check("resolving it again yields the SAME row, not a duplicate",
                !again.isNew && String(again.id) === String(fresh.id), `${String(again.id)} vs ${String(fresh.id)}`);

            const rows = await table(PropertyRouteEntity)
                .filter(pr => pr.path == "shipAddress.city").toArray() as PropertyRouteEntity[];
            check("exactly one row exists for the route", rows.length === 1, String(rows.length));

            // The sync counterpart the XML importers use.
            const viaSync = PropertyRouteLogic.propertyRouteEntitySync(fresh.rootType, "shipAddress.city");
            check("propertyRouteEntitySync finds the persisted row",
                !viaSync.isNew && String(viaSync.id) === String(fresh.id));

            // ---- the serializer hook (Signum's AfterDeserialization) ------------------------------
            // A client editor builds the route itself, so it arrives WITHOUT an id. The hook must point it
            // at the row that already exists, or every save would insert a duplicate.
            const posted = Serializer.parse(
                Serializer.stringify(PropertyRouteEntity.create({ rootType: fresh.rootType, path: "shipAddress.city" })),
            ) as PropertyRouteEntity;
            check("a client-built route deserializes onto the persisted row",
                !posted.isNew && String(posted.id) === String(fresh.id), `isNew=${posted.isNew} id=${String(posted.id)}`);
            check("and arrives CLEAN, so saving its owner does not rewrite it", !posted.isModifiedSelf());

            // An UNKNOWN route stays new — that is what creates the row on demand.
            const unknown = Serializer.parse(
                Serializer.stringify(PropertyRouteEntity.create({ rootType: fresh.rootType, path: "shipName" })),
            ) as PropertyRouteEntity;
            check("a route with no row stays NEW (so the save creates it)", unknown.isNew);
        } finally {
            if (!fresh.isNew)
                await fresh.delete();
        }
    });

    // Cleaned up, so the probe is repeatable.
    const leftover = await ExecutionMode.global(() => table(PropertyRouteEntity)
        .filter(pr => pr.path == "shipAddress.city").toArray()) as PropertyRouteEntity[];
    check("the probe leaves no rows behind", leftover.length === 0, String(leftover.length));

    // ---- the delete cascades ---------------------------------------------------------------------
    // Signum registers one per consumer that references a route (Tour, Help, TranslatedInstance) and altea
    // adds the one Signum lacks (DynamicValidation). Without them a sync removing a route fails on an FK.
    const events = Schema.current.entityEvents(PropertyRouteEntity);
    check("every route-referencing module registers a preDeleteSqlSync cascade",
        events.preDeleteSqlSync.length >= 4, String(events.preDeleteSqlSync.length));

    const victim = PropertyRouteEntity.create({ rootType: TypeEntity.newLite(1, "Order") as never, path: "x" });
    victim.id = -1 as never;
    victim.isNew = false;
    const script = events.onPreDeleteSqlSync(victim);
    const sql = script?.toString() ?? "";
    for (const expected of ["css_step", "type_help__property", "dynamic_validation", "translated_instance"])
        check(`the cascade deletes from ${expected}`, sql.toLowerCase().includes(expected), sql.slice(0, 400));

    // A TYPE being removed takes its routes with it (Signum's PropertyRouteLogic_PreDeleteSqlSync).
    check("a TypeEntity delete cascades to its routes",
        Schema.current.entityEvents(TypeEntity).preDeleteSqlSync.length >= 1);

    // ---- the expression-route seam (legacy mode) -------------------------------------------------
    // Signum writes `ValueInStock` as a computed PROPERTY, so it is an ordinary route with an ordinary
    // row — and a Southwind database has an auth rule on it. altea's is a `@quoted` METHOD, invisible to
    // route generation, so without this the sync offered it as a rename of `Ticks` and then dropped it,
    // taking the rule with it. See PropertyRouteLogic.extraSyncRoutes / quotedExpressionRoutes.
    check("the model alone does NOT name an expression member",
        !PropertyRoute.generateRoutes(ProductEntity, true).some(pr => pr.propertyString() === "valueInStock"));

    const declared = declaredLegacyRoutes(ProductEntity);
    check("a @legacyPropertyRoute member is one", declared.includes(storedMemberName("valueInStock")),
        declared.join(", "));
    check("...and nothing else on that type", declared.length === 1, declared.join(", "));

    // DECLARED, never derived: an undeclared @quoted member gets NOTHING. `TimeSpanEmbedded.add` /
    // `subtract` and `Category.toString` are all @quoted and none is a C# property, which is a fact about
    // the PORT — Signum has no route for an extension method or for a ToString override, and reading that
    // off the shape of the TypeScript would be guessing at the C# from its translation.
    check("an undeclared @quoted member is NOT a route", declaredLegacyRoutes(TimeSpanEmbedded).length === 0,
        declaredLegacyRoutes(TimeSpanEmbedded).join(", "));
    check("a @quoted toString is NOT a route", !declaredLegacyRoutes(CategoryEntity).includes("ToString"),
        declaredLegacyRoutes(CategoryEntity).join(", "));

    // The path is spelled by the SAME function a real route uses, so the two cannot drift...
    check("a declared route is spelled like a real one",
        declaredLegacyRoutes(ProductEntity)[0] === storedMemberName("valueInStock"));
    // ...unless the declaration names Signum's own spelling, for a member altea deliberately RENAMED
    // (Signum's property is `Duration`; naming it `durationSeconds` says what the unit is).
    check("an explicit Signum name is used verbatim",
        declaredLegacyRoutes(SessionLogEntity).includes("Duration"),
        declaredLegacyRoutes(SessionLogEntity).join(", "));
    // A property on an abstract base is a route of every type deriving from it, as in Signum.
    check("a declaration is inherited by a subclass",
        declaredLegacyRoutes(OrderEntity).includes(storedMemberName("totalPrice")),
        declaredLegacyRoutes(OrderEntity).join(", "));

    // NORMAL mode registers no handler at all: there the database is one altea generated, so it holds no
    // route the model cannot name, and faking one could only ever hide a genuine removal.
    check("normal mode adds no expression route",
        !PropertyRouteLogic.modelPaths(ProductEntity, true).has("valueInStock"));

    // What the synchronizer diffs against the stored rows, once legacy mode has registered the handler.
    PropertyRouteLogic.extraSyncRoutes.push(declaredLegacyRoutes);
    try {
        const paths = PropertyRouteLogic.modelPaths(ProductEntity, true);
        check("the seam adds it to what the sync diffs",
            paths.has(storedMemberName("valueInStock")) && paths.has(storedMemberName("unitPrice")),
            [...paths].join(", "));
        // A handler naming a route the model already has must collapse, not duplicate.
        PropertyRouteLogic.extraSyncRoutes.push(() => ["unitPrice", "valueInStock"]);
        check("naming an existing route is a no-op",
            PropertyRouteLogic.modelPaths(ProductEntity, true).size === paths.size);
        PropertyRouteLogic.extraSyncRoutes.pop();
    } finally {
        PropertyRouteLogic.extraSyncRoutes.pop();
    }

    // ---- report ----------------------------------------------------------------------------------
    console.log(`\n${pass} checks passed, ${failures.length} failed`);
    for (const f of failures)
        console.log("  FAIL " + f);

    await Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

function checkFk(label: string, ctor: Function, field: string, expectedColumn: string): void {
    const t = Schema.current.table(ctor as never);
    const column = t.fields[field]?.field.columns()[0];
    check(`${label}.${expectedColumn} points at the routes table`,
        column != null && column.name.toLowerCase() === expectedColumn,
        column?.name ?? `no column for '${field}'`);
}

void main();
