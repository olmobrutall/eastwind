// The change log's STORED half — one row per user saying when they last read it (Signum's
// ChangeLogViewLogEntity + ChangeLogLogic).
//
// The entries themselves are source, not data (a Changelog.ts per module, merged client-side — that merge
// is unit-tested in altea/test/client/changeLog.test.ts). What only a real database can show is the part
// here: that the table matches Signum's column for column, that the row is created on first read and
// UPDATED rather than duplicated afterwards, that it is per user, and that both calls tolerate an
// anonymous caller instead of throwing on a null user.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeChangeLog.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { Schema } from "@altea/altea/server/schema/schema";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { UserHolder } from "@altea/altea/server/userHolder";
import { UserWithClaims } from "@altea/altea/data/security";
import { table } from "@altea/altea/server/table";
import { Temporal } from "@altea/altea/data/basics";
import { ChangeLogViewLogEntity } from "@altea/altea/data/changeLog";
import { ChangeLogLogic } from "@altea/altea/server/changeLogLogic";
import { UserEntity } from "@altea/altea-auth/data/User";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    // ---- the table ---------------------------------------------------------------------------------
    // Signum's basics.ChangeLogViewLog: Id, Ticks, User_id (an @implementedByAll-free reference), LastDate.
    const t = Schema.current.table(ChangeLogViewLogEntity);
    const name = t.name.toString().toLowerCase();
    check("table is basics.change_log_view_log",
        name.includes("change_log_view_log") && name.includes("basics"), name);

    const columns = Object.keys(t.columns).map(c => c.toLowerCase());
    for (const expected of ["id", "ticks", "user_id_user", "last_date"])
        check(`column ${expected}`, columns.includes(expected), columns.join(", "));
    check("no column Signum does not have", columns.length === 4, columns.join(", "));

    // ONE row per user, so Signum declares the reference [UniqueIndex].
    const unique = [...t.indexes.values()].filter(i =>
        i.unique && i.columns.length === 1 && i.columns[0]!.name.toLowerCase() === "user_id_user");
    check("the user reference carries a UNIQUE index", unique.length === 1, String(unique.length));

    // ---- anonymous ---------------------------------------------------------------------------------
    // Signum reads UserHolder.Current.User unguarded, which is safe there only because its controller sits
    // behind global authentication. altea's navbar renders on the login screen, so both calls must cope.
    check("getLastDate answers nothing with no user", await ChangeLogLogic.getLastDate() == undefined);
    await ChangeLogLogic.updateLastDate();
    check("updateLastDate is a no-op with no user, not a throw", true);

    // ---- per user ----------------------------------------------------------------------------------
    const users = await ExecutionMode.global(() => table(UserEntity).toArray()) as UserEntity[];
    const first = users.find(u => u.userName === "System") ?? users[0];
    const second = users.find(u => u.id !== first?.id);
    check("two users to test with", first != null && second != null, users.map(u => u.userName).join(", "));
    if (first == null || second == null)
        return report();

    const rowsFor = async (u: UserEntity): Promise<ChangeLogViewLogEntity[]> =>
        await ExecutionMode.global(() => table(ChangeLogViewLogEntity)
            .filter(cl => cl.user.is(u.toLite())).toArray()) as ChangeLogViewLogEntity[];

    // Start clean, so re-running says the same thing.
    for (const u of [first, second])
        await ExecutionMode.global(async () => {
            for (const row of await rowsFor(u))
                await row.delete();
        });

    await UserHolder.withUser(new UserWithClaims(first.toLite(), { Role: first.role }), async () => {
        check("a user who never read it has no date", await ChangeLogLogic.getLastDate() == undefined);

        await ChangeLogLogic.updateLastDate();
        const after = await ChangeLogLogic.getLastDate();
        check("reading it stamps a date", after != undefined, String(after));
        check("and exactly one row exists", (await rowsFor(first)).length === 1);

        // The second read must UPDATE that row, not insert a second one — which is what the unique index
        // enforces and what the "create it if absent" branch has to get right.
        const firstDate = after!;
        await ChangeLogLogic.updateLastDate();
        const rows = await rowsFor(first);
        check("reading it again keeps ONE row", rows.length === 1, String(rows.length));
        check("and moves the date forward (or leaves it, never back)",
            Temporal.PlainDateTime.compare(rows[0]!.lastDate, firstDate) >= 0,
            `${rows[0]!.lastDate.toString()} vs ${firstDate.toString()}`);
    });

    // Another user is independent — the badge is per person.
    await UserHolder.withUser(new UserWithClaims(second.toLite(), { Role: second.role }), async () => {
        check("another user still has no date", await ChangeLogLogic.getLastDate() == undefined);
        await ChangeLogLogic.updateLastDate();
        check("and gets a row of their own", (await rowsFor(second)).length === 1);
    });

    check("the first user's row is untouched by the second", (await rowsFor(first)).length === 1);

    // Leave nothing behind.
    for (const u of [first, second])
        await ExecutionMode.global(async () => {
            for (const row of await rowsFor(u))
                await row.delete();
        });
    check("the probe cleans up after itself",
        (await rowsFor(first)).length === 0 && (await rowsFor(second)).length === 0);

    return report();
}

function report(): void {
    console.log(`\n${pass} checks passed, ${failures.length} failed`);
    for (const f of failures)
        console.log("  FAIL " + f);
    void Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

void main();
