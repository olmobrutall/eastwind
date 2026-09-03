// UserTicket: the "remember me" credential (Signum.Authorization/UserTicket). What matters is not that a
// row can be written, but the four rules around it — rotation, the per-user cap, expiry, and the two ways
// a ticket is REVOKED (a password change, and a user who stops being Active). Each one is a way a stale
// credential could otherwise keep working.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeUserTicket.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { deleteList } from "@altea/altea/server/Database";
import { UserHolder } from "@altea/altea/server/userHolder";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { UserWithClaims } from "@altea/altea/data/security";
import { Clock } from "@altea/altea/data/utils/clock";
import { UserEntity, UserState } from "@altea/altea-auth/data/User";
import { UserTicketEntity, parseTicket } from "@altea/altea-auth/data/UserTicket";
import { UserTicketLogic } from "@altea/altea-auth/server/UserTicketLogic";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

function ticketsOf(user: UserEntity): Promise<UserTicketEntity[]> {
    return ExecutionMode.global(async () =>
        await table(UserTicketEntity).filter(ut => ut.user.is(user)).toArray() as UserTicketEntity[]);
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    check("the module is started", UserTicketLogic.isStarted());

    const users = await table(UserEntity)
        .filter(u => u.userName == "System" || u.userName == "Steven").toArray() as UserEntity[];
    const system = users.find(u => u.userName === "System")!;
    const other = users.find(u => u.userName === "Steven")!;
    check("two users to test with", system != null && other != null, users.map(u => u.userName).join(", "));

    // Start clean, so re-running says the same thing.
    const clean = async (): Promise<void> => {
        await ExecutionMode.global(async () => {
            await deleteList(await table(UserTicketEntity).toArray() as UserTicketEntity[]);
        });
    };
    await clean();

    await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
        // ---- issuing ------------------------------------------------------------------------------
        const text = await UserTicketLogic.newTicket("probe/1.0");
        const parsed = parseTicket(text);
        check("the cookie text parses back", String(parsed.userId) === String(system.id),
            `${parsed.userId} vs ${system.id}`);
        check("the secret is a 36-char uuid", parsed.ticket.length === 36, parsed.ticket);

        const rows = await ticketsOf(system);
        check("one row was written", rows.length === 1, String(rows.length));
        check("the device was recorded", rows[0]!.device === "probe/1.0", rows[0]!.device);

        // ---- rotation -----------------------------------------------------------------------------
        // The presented ticket is exchanged for a NEW secret; the user comes back with it.
        const updated = await UserTicketLogic.updateTicket("probe/1.0", text);
        check("updateTicket answers the right user", updated.user.id === system.id, String(updated.user.id));
        check("the secret rotated", parseTicket(updated.ticket).ticket !== parsed.ticket);

        // ---- a ticket that does not exist ---------------------------------------------------------
        const bogus = `${system.id}|00000000-0000-0000-0000-000000000000`;
        let rejected = false;
        try { await UserTicketLogic.updateTicket("probe/1.0", bogus); } catch { rejected = true; }
        check("an unknown ticket is refused", rejected);

        let malformed = false;
        try { await UserTicketLogic.updateTicket("probe/1.0", "not-a-ticket"); } catch { malformed = true; }
        check("a malformed ticket is refused", malformed);

        // ---- the per-user cap ---------------------------------------------------------------------
        // Signum's MaxTicketsPerUser: the sweep runs on the way IN, so issuing well past the cap leaves
        // at most maxTicketsPerUser + 1 (the one just written is not subject to its own sweep).
        await clean();
        for (let i = 0; i < UserTicketLogic.maxTicketsPerUser + 4; i++)
            await UserTicketLogic.newTicket("probe/device-" + i);

        const capped = await ticketsOf(system);
        check("the per-user cap is enforced", capped.length <= UserTicketLogic.maxTicketsPerUser + 1,
            `${capped.length} rows for a cap of ${UserTicketLogic.maxTicketsPerUser}`);
        // The ones kept must be the NEWEST (Signum orders by ConnectionDate descending before skipping).
        check("the newest survive", capped.some(t => t.device === "probe/device-7"),
            capped.map(t => t.device).join(", "));

        // ---- expiry -------------------------------------------------------------------------------
        // Backdate a row past expirationInterval and issue again: the sweep on the way in removes it.
        await clean();
        const fresh = await UserTicketLogic.newTicket("probe/fresh");
        await ExecutionMode.global(async () => {
            const row = (await table(UserTicketEntity).toArray() as UserTicketEntity[])[0]!;
            row.connectionDate = Clock.now.subtract({ days: 365 });
            await row.save();
        });
        await UserTicketLogic.newTicket("probe/second");
        const afterExpiry = await ticketsOf(system);
        check("an expired ticket is swept", !afterExpiry.some(t => t.device === "probe/fresh"),
            afterExpiry.map(t => t.device).join(", "));
        // And it is no longer accepted, which is the point of the sweep.
        let expiredRejected = false;
        try { await UserTicketLogic.updateTicket("probe/x", fresh); } catch { expiredRejected = true; }
        check("an expired ticket is refused", expiredRejected);

        // ---- a password change revokes everything -------------------------------------------------
        await clean();
        await UserTicketLogic.newTicket("probe/before-password-change");
        check("a ticket exists before the change", (await ticketsOf(system)).length === 1);

        await ExecutionMode.global(async () => {
            const u = await table(UserEntity).filter(x => x.id == system.id).single() as UserEntity;
            const hash = u.passwordHash!;
            // A DIFFERENT hash: flip one byte, which is what "the password changed" looks like here.
            const changed = Uint8Array.from(hash);
            changed[0] = (changed[0]! ^ 0xff) & 0xff;
            u.passwordHash = changed;
            await u.save();
            // Put it back, so the probe leaves the user able to log in.
            u.passwordHash = hash;
            await u.save();
        });
        check("a password change revokes every ticket", (await ticketsOf(system)).length === 0,
            (await ticketsOf(system)).map(t => t.device).join(", "));
    });

    // ---- a ticket is PER USER -------------------------------------------------------------------
    await clean();
    await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
        await UserTicketLogic.newTicket("probe/system");
    });
    check("another user has no tickets", (await ticketsOf(other)).length === 0);

    // ---- deactivation revokes everything --------------------------------------------------------
    // Signum's UserGraph.OnDeactivated / AutoDeactivate both call RemoveTickets; altea routes both
    // through AuthLogic.onRemoveUserTickets, which UserTicketLogic.start fills.
    await UserHolder.withUser(new UserWithClaims(other.toLite(), { Role: other.role }), async () => {
        await UserTicketLogic.newTicket("probe/other");
    });
    check("the other user now has one", (await ticketsOf(other)).length === 1);

    const wasState = other.state;
    other.state = UserState.Deactivated;
    const removed = await UserTicketLogic.removeTickets(other);
    check("removeTickets acts on a non-active user", removed === 1, String(removed));
    check("their tickets are gone", (await ticketsOf(other)).length === 0);
    other.state = wasState;
    check("removeTickets leaves an ACTIVE user alone", await UserTicketLogic.removeTickets(other) === null);

    await clean();
    console.log(`\n[userticket] ${pass} checks passed`);
    for (const f of failures)
        console.log("  FAILED " + f);

    await Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
