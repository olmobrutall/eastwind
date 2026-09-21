// The HTTP half of the test harness: where the running stack is, and how to tell it that the database
// underneath it has been replaced.
//
// The suite does NOT start the stack — `pnpm --filter eastwind stack local` does, in another terminal,
// exactly as the suite assumes a running API host. What the suite does is
// restore the database before each test, and a server holding rows in memory has no way of noticing that:
// hence {@link clearServerCaches}.

/** Where the application under test is served (the vite dev server by default). */
export function baseUrl(): string {
    return (process.env["EASTWIND_URL"] ?? "http://localhost:5173/").replace(/\/+$/, "") + "/";
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
