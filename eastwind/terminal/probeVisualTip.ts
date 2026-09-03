// VisualTip: the per-user "I have read this tip" record, which is what makes the icon stop beating.
//
// Run: node --import @altea/altea/register.mjs --env-file=.env.postgres dist/terminal/probeVisualTip.js
import { Starter } from "../starter.server";
import { Connector } from "@altea/altea/server/connection/connector";
import { table } from "@altea/altea/server/table";
import { deleteList } from "@altea/altea/server/Database";
import { UserHolder } from "@altea/altea/server/userHolder";
import { ExecutionMode } from "@altea/altea/server/executionMode";
import { UserWithClaims } from "@altea/altea/data/security";
import { SearchVisualTip, VisualTipSymbol, VisualTipConsumedEntity } from "@altea/altea/data/visualTip";
import { VisualTipLogic } from "@altea/altea/server/visualTipLogic";
import { UserEntity } from "@altea/altea-auth/data/User";

let pass = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string): void {
    if (ok) { pass++; console.log("  OK   " + name); return; }
    failures.push(name + (detail == null ? "" : ": " + detail));
}

async function main(): Promise<void> {
    await Starter.start(process.env["EASTWIND_DB"]!);

    // The four the SearchControl carries are registered by the module itself, and SEEDED like any symbol.
    const seeded = await table(VisualTipSymbol).toArray() as VisualTipSymbol[];
    check("the four SearchControl tips are seeded",
        ["SearchHelp", "GroupHelp", "FilterHelp", "ColumnHelp"]
            .every(n => seeded.some(s => s.key === "SearchVisualTip." + n)),
        seeded.map(s => s.key).join(", "));

    check("the registry lists them", VisualTipLogic.registeredVisualTips().length >= 4,
        String(VisualTipLogic.registeredVisualTips().length));

    const users = await table(UserEntity).filter(u => u.userName == "System" || u.userName == "Steven").toArray() as UserEntity[];
    const system = users.find(u => u.userName === "System")!;
    const other = users.find(u => u.userName === "Steven");
    check("two users to test with", other != null, users.map(u => u.userName).join(", "));

    // Start clean, so re-running says the same thing.
    await ExecutionMode.global(async () => {
        await deleteList(await table(VisualTipConsumedEntity).toArray() as VisualTipConsumedEntity[]);
    });

    await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
        check("nothing is read yet", (await VisualTipLogic.getConsumed())?.length === 0,
            JSON.stringify(await VisualTipLogic.getConsumed()));

        await VisualTipLogic.consume(SearchVisualTip.FilterHelp.key);
        const after = await VisualTipLogic.getConsumed();
        check("consuming records it", after?.includes(SearchVisualTip.FilterHelp.key) === true,
            JSON.stringify(after));

        // Signum guards with `Any()` before inserting; the unique index on (tip, user) is the real
        // enforcement, so a second consume must not throw.
        await VisualTipLogic.consume(SearchVisualTip.FilterHelp.key);
        const twice = await VisualTipLogic.getConsumed();
        check("consuming twice is idempotent", twice?.length === 1, JSON.stringify(twice));
    });

    // The record is PER USER — the whole reason the subsystem has a second table.
    if (other != null)
        await UserHolder.withUser(new UserWithClaims(other.toLite(), { Role: other.role }), async () => {
            const theirs = await VisualTipLogic.getConsumed();
            check("another user has read nothing", theirs?.length === 0, JSON.stringify(theirs));
        });

    // The "demo mode" switch: null means "consuming is disabled", and the client then treats every tip as
    // unread rather than as read.
    const previous = VisualTipLogic.isConsumeEnabled;
    VisualTipLogic.isConsumeEnabled = () => false;
    await UserHolder.withUser(new UserWithClaims(system.toLite(), { Role: system.role }), async () => {
        check("disabled consuming answers null", await VisualTipLogic.getConsumed() === null);
    });
    VisualTipLogic.isConsumeEnabled = previous;

    console.log(`\n[visualtip] ${pass} checks passed`);
    for (const f of failures)
        console.log("  FAILED " + f);

    await Connector.current().closeConnection();
    process.exit(failures.length === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
