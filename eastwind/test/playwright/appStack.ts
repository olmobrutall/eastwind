// The HTTP half of the test harness: where the running stack is, and how to tell it that the database
// underneath it has been replaced.
//
// The suite does NOT start the stack — `pnpm --filter eastwind stack local` does, in another terminal,
// exactly as the suite assumes a running API host. What the suite does is
// restore the database before each test, and a server holding rows in memory has no way of noticing that:
// hence {@link clearServerCaches}.

/**
 * Where the application under test is served (the vite dev server by default).
 *
 * EASTWIND_URL points the suite at a stack somewhere else entirely; CLIENT_PORT is the ordinary case —
 * the same variable the stack binds vite to, so a clone running on its own ports needs no second setting.
 * Both arrive through `pnpm --filter eastwind test <environment>`, which loads that environment’s file
 * before vitest starts (scripts/withEnv.mjs). 5173 is the default declared in scripts/ports.mjs, repeated
 * here because this file is compiled and cannot import it.
 */
export function baseUrl(): string {
    const fallback = `http://localhost:${process.env["CLIENT_PORT"] ?? 5173}/`;
    return (process.env["EASTWIND_URL"] ?? fallback).replace(/\/+$/, "") + "/";
}

/** The API the client talks to. In dev, vite proxies `/api` through to it, so one base URL is enough. */
function apiUrl(path: string): string {
    return baseUrl() + path.replace(/^\/+/, "");
}

/**
 * Drop every cached table and global lazy in the RUNNING server, so it re-reads the restored database.
 *
 * It posts to `api/cache/invalidateAll`, the anonymous broadcast-peer endpoint, authenticated by a
 * shared-secret hash. eastwind has no such peer (its broadcast is PostgreSQL LISTEN/NOTIFY, which has no
 * HTTP surface), so this uses the endpoint a human would: `POST /api/cache/clear`, gated by
 * `CachePermission.InvalidateCache` — hence the login.
 *
 * Best-effort on purpose: it returns the failure rather than throwing. A restore is already correct for
 * everything the server cached BEFORE the test (the snapshot is byte-identical, so every cached id still
 * resolves); this only matters for what the test itself wrote into a cached table, and a suite must not
 * fail to start because a dev stack is not running yet — the first navigation will say so far more
 * clearly.
 */
export async function clearServerCaches(userName = "System", password = "System"): Promise<string | null> {
    try {
        const login = await fetch(apiUrl("api/auth/login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userName, password }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!login.ok)
            return `login as '${userName}' returned ${login.status}`;

        const { token } = await login.json() as { token: string };

        const clear = await fetch(apiUrl("api/cache/clear"), {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}` },
            signal: AbortSignal.timeout(10_000),
        });
        return clear.ok ? null : `api/cache/clear returned ${clear.status}`;
    } catch (e) {
        return (e as Error).message;
    }
}
