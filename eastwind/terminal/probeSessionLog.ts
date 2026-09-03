// SessionLog: one row per login, closed on logout. Three things are worth pinning — the PERMISSION gate
// (a role is logged only if it is authorized for TrackSession), the closing logic (Signum's narrowing is
// "the latest row, and only if it is still open", which is deliberately not "the latest open row"), and
// that `durationSeconds` really lowers to SQL, since a nullable ternary is exactly the shape that silently
// does not (see altea-alert's CurrentState).
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeSessionLog.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { deleteList } from "@altea/altea/server/Database";
import { Schema } from "@altea/altea/server/schema/schema";
import { UserHolder } from "@altea/altea/server/userHolder";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { UserWithClaims } from "@altea/altea/data/security";
import { Clock } from "@altea/altea/data/utils/clock";
import { UserEntity } from "@altea/altea-auth/data/User";
import { SessionLogEntity, SessionLogPermission } from "@altea/altea-auth/data/SessionLog";
import { SessionLogLogic } from "@altea/altea-auth/server/SessionLogLogic";
import { PermissionAuthLogic } from "@altea/altea-auth/server/PermissionAuthLogic";
import { PermissionSymbol } from "@altea/altea-auth/data/Rules";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

function rowsOf(user: UserEntity): Promise<SessionLogEntity[]> {
    return ExecutionMode.global(async () =>
        await table(SessionLogEntity).filter(sl => sl.user.is(user)).toArray() as SessionLogEntity[]);
}

const clean = (): Promise<void> => ExecutionMode.global(async () => {
    await deleteList(await table(SessionLogEntity).toArray() as SessionLogEntity[]);
});

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    check("the module is started", SessionLogLogic.isStarted());

    // Signum has no [TicksColumn(false)] here, so the table carries a stamp like any other entity.
    const t = Schema.current.table(SessionLogEntity);
    check("the table is included", t != null);
    check("it has a concurrency stamp (as Signum's does)", t.columns["ticks"] != null);

    const symbol = await ExecutionMode.global(async () =>
        await table(PermissionSymbol).filter(p => p.key == "SessionLogPermission.TrackSession").singleOrNull());
    check("the TrackSession permission is seeded", symbol != null);

    const users = await table(UserEntity)
        .filter(u => u.userName == "System" || u.userName == "Steven").toArray() as UserEntity[];
    const system = users.find(u => u.userName === "System")!;
    const other = users.find(u => u.userName === "Steven")!;
    check("two users to test with", system != null && other != null, users.map(u => u.userName).join(", "));

    // ---- the PERMISSION gate ---------------------------------------------------------------------
    // A role with no explicit rule falls back to the ROLE's own default (Signum's GetAllowedBase), so this
    // reports what each of eastwind's roles actually resolves to rather than assuming.
    for (const u of [system, other]) {
        const tracked = await PermissionAuthLogic.isAuthorizedForRole(
            SessionLogPermission.TrackSession, u.role.key());
        console.log(`  (role ${u.role.toString()} tracked = ${tracked})`);
    }
    const systemTracked = await PermissionAuthLogic.isAuthorizedForRole(
        SessionLogPermission.TrackSession, system.role.key());

    await clean();
    try {
        // ---- opening a session -------------------------------------------------------------------
        await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
            await SessionLogLogic.sessionStart("localhost:3001", "ProbeAgent/1.0");
        });

        const opened = await rowsOf(system);
        check("a row is written exactly when the role is tracked",
            opened.length === (systemTracked ? 1 : 0), `${opened.length} rows, tracked=${systemTracked}`);

        if (!systemTracked) {
            // Nothing further is observable without the grant; say so rather than reporting false passes.
            console.log("\n  NOTE: this role is not authorized for TrackSession, so the remaining checks");
            console.log("  would all be vacuous. Grant it to exercise the recording paths.");
            console.log(`\n[sessionlog] ${pass} checks passed`);
            await Connector.current().closeConnection();
            process.exit(failures.length === 0 ? 0 : 1);
        }

        const row = opened[0]!;
        check("the host address is recorded", row.userHostAddress === "localhost:3001", String(row.userHostAddress));
        check("the user agent is recorded", row.userAgent === "ProbeAgent/1.0", String(row.userAgent));
        check("the start is truncated to seconds", row.sessionStart.millisecond === 0,
            row.sessionStart.toString());
        check("the session is open", row.sessionEnd == null && row.sessionTimeOut === false);
        check("duration is null while open", row.durationSeconds() == null, String(row.durationSeconds()));

        // ---- durationSeconds LOWERS TO SQL -------------------------------------------------------
        // The risky one: a nullable ternary is exactly the shape that silently fails to translate. Both a
        // projection and an ORDER BY, because the column exists to be sorted.
        const projected = await ExecutionMode.global(async () =>
            await table(SessionLogEntity).map(sl => sl.durationSeconds()).toArray());
        check("durationSeconds projects in SQL", projected.length === 1 && projected[0] == null,
            JSON.stringify(projected));
        const ordered = await ExecutionMode.global(async () =>
            await table(SessionLogEntity).orderByDescending(sl => sl.durationSeconds()).toArray());
        check("durationSeconds orders in SQL", ordered.length === 1);

        // ---- closing it --------------------------------------------------------------------------
        await SessionLogLogic.sessionEnd(system, null);
        const closed = (await rowsOf(system))[0]!;
        check("the session is closed", closed.sessionEnd != null, String(closed.sessionEnd));
        check("it is not flagged as a timeout", closed.sessionTimeOut === false);
        check("the end is truncated to seconds", closed.sessionEnd!.millisecond === 0,
            closed.sessionEnd!.toString());
        check("duration is now a number", typeof closed.durationSeconds() === "number",
            String(closed.durationSeconds()));

        // ---- Signum's exact narrowing ------------------------------------------------------------
        // "the LATEST row, and only if it is still open" — so closing again must NOT reopen or re-close
        // anything, and an older open row must stay open.
        const endWas = closed.sessionEnd!.toString();
        await SessionLogLogic.sessionEnd(system, null);
        const again = (await rowsOf(system))[0]!;
        check("closing twice changes nothing", again.sessionEnd!.toString() === endWas,
            `${again.sessionEnd!.toString()} vs ${endWas}`);

        // A SECOND session for the same user, left open, then closed with a timeOut.
        await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
            await SessionLogLogic.sessionStart("localhost:3001", "ProbeAgent/2.0");
        });
        check("a second login opens a second row", (await rowsOf(system)).length === 2);

        const before = Clock.now;
        await SessionLogLogic.sessionEnd(system, { minutes: 30 });
        const rows = (await rowsOf(system)).sort((a, b) =>
            a.sessionStart.toString() < b.sessionStart.toString() ? -1 : 1);
        const second = rows.find(r => r.userAgent === "ProbeAgent/2.0")!;
        check("the timeout row is flagged", second.sessionTimeOut === true);
        check("the end is BACKDATED by the timeout",
            second.sessionEnd != null && second.sessionEnd.until(before).total({ unit: "minutes" }) >= 29,
            String(second.sessionEnd));
        // ...and the FIRST row was not touched a third time.
        const first = rows.find(r => r.userAgent === "ProbeAgent/1.0")!;
        check("the earlier session was left alone", first.sessionEnd!.toString() === endWas
            && first.sessionTimeOut === false, first.sessionEnd!.toString());

        // ---- per USER ----------------------------------------------------------------------------
        check("another user has no sessions", (await rowsOf(other)).length === 0);
    } finally {
        await clean();
    }

    console.log(`\n[sessionlog] ${pass} checks passed`);
    for (const f of failures)
        console.log("  FAILED " + f);

    await Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
