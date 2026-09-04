// The five siblings of DynamicType, exercised for real.
//
// They use the two mechanisms the compiled half offers, and this probe covers one of each:
//
//   GENERATED  — DynamicExpression becomes a `withQuoted` member plus a `QueryLogic.expressions.register`,
//                so the test is that its token EXISTS and that the expression runs IN SQL. (Same mechanism
//                as DynamicTypeCondition and DynamicMixinConnection.)
//   EVALUATED  — DynamicValidation is compiled per row by @altea/altea-eval and hooked into core's new
//                `globalValidators`, so the test is that saving an entity the script rejects FAILS with the
//                script's own message.
//
// Both need a RESTART between defining and using, because a generated module is compiled while the schema
// is built — hence the two phases.
//
// Run: node … dist/terminal/probeDynamicSiblings.js define
//      node … dist/terminal/probeDynamicSiblings.js use
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { Operations } from "@altea/altea/server/operationLogic";
import { UserHolder } from "@altea/altea/server/userHolder";
import { UserWithClaims } from "@altea/altea/data/security";
import { QueryLogic } from "@altea/altea/server/dynamicQuery/queryLogic";
import { SubTokensOptionsAll } from "@altea/altea/data/dynamicQuery/tokens/queryToken";
import { parseQueryRequest, toWireResultTable } from "@altea/altea/server/queryServer";
import { entityIntegrityCheckAsync } from "@altea/altea/data/validation";
import { DynamicExpressionEntity, DynamicExpressionOperation } from "@altea/altea-dynamic/data/DynamicExpression";
import { DynamicValidationEntity, DynamicValidationOperation } from "@altea/altea-dynamic/data/DynamicValidation";
import { DynamicValidationEval } from "@altea/altea-dynamic/data/DynamicValidation";
import { DynamicLogic } from "@altea/altea-dynamic/server/DynamicLogic.server";
import { PropertyRouteLogic } from "@altea/altea/server/propertyRouteLogic";
import { TypeLogic } from "@altea/altea/server/typeLogic";
import { UserEntity } from "@altea/altea-auth/data/User";
import { ShipperEntity } from "../shippers/Shipper.data";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

async function asSystem<T>(fn: () => Promise<T>): Promise<T> {
    const system = (await table(UserEntity).filter(u => u.userName == "System").toArray())[0] as UserEntity;
    return await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), fn);
}

async function define(): Promise<void> {
    await asSystem(async () => {
        // 1. an EXPRESSION on Shipper: its name in upper case. Trivial on purpose — what is under test is
        //    that a generated `withQuoted` member becomes a real query token that SQL can evaluate.
        const existingExp = (await table(DynamicExpressionEntity)
            .filter(e => e.name == "UpperName").toArray() as DynamicExpressionEntity[])[0];

        const exp = existingExp ?? DynamicExpressionEntity.create({
            name: "UpperName",
            fromType: "ShipperEntity",
            returnType: "string",
            body: "e.companyName.toUpperCase()",
        });
        await Operations.execute(exp, DynamicExpressionOperation.Save);
        console.log(`[define] DynamicExpression 'UpperName' on ShipperEntity saved (id ${exp.id})`);

        // 2. a VALIDATION on Shipper: the phone must not be the literal "BAD".
        const existingVal = (await table(DynamicValidationEntity)
            .filter(v => v.name == "PhoneIsNotBad").toArray() as DynamicValidationEntity[])[0];

        const val = existingVal ?? DynamicValidationEntity.create({
            name: "PhoneIsNotBad",
            // The TypeEntity ROW for the ctor — TypeLogic caches both directions.
            entityType: TypeLogic.idToEntity(TypeLogic.typeToId(ShipperEntity))!,
            // The route the validation applies to is a ROW now (see PropertyRouteLogic); it is created on
            // demand and saved with the validation.
            subEntity: PropertyRouteLogic.propertyRouteEntitySync(
                TypeLogic.idToEntity(TypeLogic.typeToId(ShipperEntity))!, "phone"),
        });
        val.eval = DynamicValidationEval.create({
            script: `return e.phone === "BAD" ? "The phone must not be BAD" : null;`,
        });
        await Operations.execute(val, DynamicValidationOperation.Save);
        console.log(`[define] DynamicValidation 'PhoneIsNotBad' on ShipperEntity saved (id ${val.id})`);
    });

    console.log("[define] now RESTART (run `use`) — the expression is compiled while the schema is built.");
}

async function use(): Promise<void> {
    if (DynamicLogic.codeGenError != null) {
        console.log("[compile] FAILED:\n" + DynamicLogic.codeGenError.message);
        process.exitCode = 1;
        return;
    }

    const written = DynamicLogic.lastCompilation?.written ?? [];
    console.log(`[compile] ${written.length} generated module(s): ${written.join(", ")}`);
    check("the expression module was generated", written.includes("CodeGenExpressionStarter.ts"),
        written.join(", "));

    await asSystem(async () => {
        // ---- the GENERATED expression -------------------------------------------------------------------
        const queryName = QueryLogic.queries.tryGetQueryNameByKey("Shipper");
        check("the Shipper query exists", queryName != null);

        if (queryName != null) {
            try {
                const token = QueryLogic.getToken(queryName, "UpperName", SubTokensOptionsAll);
                check("the dynamic expression is a query TOKEN", token != null, token?.fullKey());

                // The point: it must be evaluated by the DATABASE. Asked the way a user asks — as a
                // COLUMN of a search — which is both the real consumption path and the one that needs no
                // TypeScript knowledge of a member generated code added (a cast inside a query lambda is
                // not quotable, so reaching for one here is the wrong tool).
                const rt = await QueryLogic.queries.executeQueryAsync(parseQueryRequest({
                    queryKey: "Shipper",
                    filters: [],
                    orders: [],
                    columns: [{ token: "companyName", displayName: "Name" }, { token: "UpperName", displayName: "Upper" }],
                    pagination: { mode: "All" },
                    groupResults: false,
                }));

                const wire = toWireResultTable(rt, {
                    queryKey: "Shipper", filters: [], orders: [],
                    columns: [{ token: "companyName", displayName: "Name" }, { token: "UpperName", displayName: "Upper" }],
                    pagination: { mode: "All" }, groupResults: false,
                });

                const wrong = wire.rows.find(r =>
                    String(r.columns[1]) !== String(r.columns[0]).toUpperCase());

                check("the expression is evaluated by the DATABASE",
                    wire.rows.length > 0 && wrong == null,
                    wrong == null ? `${wire.rows.length} rows`
                        : JSON.stringify(wrong.columns));
            } catch (e) {
                check("the dynamic expression is a query TOKEN", false, String((e as Error).message));
            }
        }

        // ---- the EVALUATED validation -------------------------------------------------------------------
        const shipper = (await table(ShipperEntity).toArray() as ShipperEntity[])[0];
        check("a shipper to test with", shipper != null);

        if (shipper != null) {
            const originalPhone = shipper.phone;

            shipper.phone = "BAD";
            const bad = await entityIntegrityCheckAsync(shipper, "Saving");
            check("the dynamic validation REJECTS the bad value",
                bad?.errors?.["phone"] === "The phone must not be BAD",
                JSON.stringify(bad?.errors ?? null));

            shipper.phone = originalPhone;
            const good = await entityIntegrityCheckAsync(shipper, "Saving");
            check("and accepts the original", good?.errors?.["phone"] == null,
                JSON.stringify(good?.errors ?? null));
        }
    });

    console.log(`\n[siblings] ${pass} checks passed`);
    for (const f of failures)
        console.log("  FAILED " + f);
    process.exitCode = failures.length === 0 ? 0 : 1;
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    if ((process.argv[2] ?? "use") === "define") await define();
    else await use();

    await Connector.current().closeConnection();
}

main().catch(e => { console.error(e); process.exit(1); });
