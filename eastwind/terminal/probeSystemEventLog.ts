// SystemEventLog: a line per PROCESS event. Two properties are the whole design, and a row written
// without them is worse than no row at all:
//
//   1. it is written in its OWN transaction, because the events worth recording happen while something
//      else is going wrong — a row that rolls back with the ambient transaction records nothing about
//      exactly the moment worth recording;
//   2. it NEVER throws. The caller is "the application is starting"; failing a boot because the boot could
//      not be logged would be worse than not logging it.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeSystemEventLog.js
import { hostname } from "node:os";
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { deleteList } from "@altea/altea/server/Database";
import { Transaction } from "@altea/altea/server/connection/transaction";
import { UserHolder } from "@altea/altea/server/userHolder";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { UserWithClaims } from "@altea/altea/data/security";
import { SystemEventLogEntity } from "@altea/altea/data/systemEventLog";
import { SystemEventLogLogic } from "@altea/altea/server/systemEventLogLogic";
import { ExceptionEntity } from "@altea/altea/data/exception";
import { ExceptionLogic } from "@altea/altea/server/exceptionLogic";
import { UserEntity } from "@altea/altea-auth/data/User";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

const rows = (): Promise<SystemEventLogEntity[]> => ExecutionMode.global(async () =>
    await table(SystemEventLogEntity).toArray() as SystemEventLogEntity[]);

const clean = (): Promise<void> => ExecutionMode.global(async () => {
    await deleteList(await table(SystemEventLogEntity).toArray() as SystemEventLogEntity[]);
});

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    check("the module is started", SystemEventLogLogic.isStarted());
    await clean();

    const createdExceptions: ExceptionEntity[] = [];
    try {
        // ---- an ordinary event, with no user -----------------------------------------------------
        check("log answers true", await SystemEventLogLogic.log("Probe Event") === true);

        let all = await rows();
        check("one row was written", all.length === 1, String(all.length));
        const row = all[0]!;
        check("the event type is recorded", row.eventType === "Probe Event", row.eventType);
        check("the machine name is this host", row.machineName === hostname(), row.machineName);
        check("no user outside a request", row.user == null, String(row.user));
        check("no exception by default", row.exception == null, String(row.exception));

        // ---- the user is recorded when there IS one ----------------------------------------------
        await clean();
        const system = await table(UserEntity).filter(u => u.userName == "System").single() as UserEntity;
        await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
            await SystemEventLogLogic.log("Probe With User");
        });
        const withUser = (await rows())[0]!;
        check("the current user is recorded", withUser.user?.id === system.id, String(withUser.user));

        // ---- an exception can be linked ----------------------------------------------------------
        await clean();
        const ex = await ExceptionLogic.logException(new Error("probe exception for SystemEventLog"));
        createdExceptions.push(ex);
        await SystemEventLogLogic.log("Probe With Exception", ex);
        const withEx = (await rows())[0]!;
        check("the exception is linked", withEx.exception?.id === ex.id,
            `${withEx.exception?.id} vs ${ex.id}`);

        // ---- (1) it SURVIVES a rolled-back ambient transaction -----------------------------------
        // The property that matters most: Signum wraps the write in `Transaction.ForceNew()` precisely so
        // that logging "something went wrong" is not undone by the failure being logged about.
        await clean();
        let rolledBack = false;
        try {
            await Transaction.create(async () => {
                await SystemEventLogLogic.log("Probe In Doomed Transaction");
                throw new Error("rolling this transaction back on purpose");
            });
        } catch { rolledBack = true; }
        check("the ambient transaction did roll back", rolledBack);

        const survived = await rows();
        check("the row SURVIVES the rollback", survived.length === 1
            && survived[0]!.eventType === "Probe In Doomed Transaction",
            `${survived.length} rows: ${survived.map(r => r.eventType).join(", ")}`);

        // ---- (2) it never THROWS -----------------------------------------------------------------
        // `eventType` has a min length of 3, so a two-character event cannot be saved. The call must
        // report that by answering false, not by throwing at its caller.
        await clean();
        let threw: string | null = null;
        let answer: boolean | null = null;
        try {
            answer = await SystemEventLogLogic.log("ab");
        } catch (e) { threw = (e as Error).message; }
        check("an unsavable event does not throw", threw == null, threw ?? "");
        check("...and answers false", answer === false, String(answer));
        check("...and wrote no row", (await rows()).length === 0);

        // It reported the failure through ExceptionLogic instead — Signum's `e.LogException(...)`.
        const logged = await ExecutionMode.global(async () =>
            await table(ExceptionEntity).filter(e => e.controllerName == "SystemEventLog.Log")
                .toArray() as ExceptionEntity[]);
        createdExceptions.push(...logged);
        check("the failure was reported to ExceptionLogic", logged.length >= 1, String(logged.length));
    } finally {
        await clean();
        await ExecutionMode.global(async () => { await deleteList(createdExceptions); });
    }

    console.log(`\n[systemeventlog] ${pass} checks passed`);
    for (const f of failures)
        console.log("  FAILED " + f);

    await Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
