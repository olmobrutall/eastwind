// The bootstrap's own failure screen: everything in MainPublic's `boot()` runs
// before React exists, so a throw there has no ErrorBoundary and no ErrorModal to land in — the page
// would just keep showing index.html's splash. This is that screen: the FIRST error, rendered by hand.
//
// Two things it must do, both learned the hard way:
//  - render an ELEMENT and take the splash down explicitly — assigning `textContent` did not trip the
//    splash's observer, so a failing /api call at boot showed a spinner that never stopped;
//  - read the error WITHOUT assuming `Error`. altea's ajax layer throws a `ServiceError`, a plain class
//    whose useful parts live on `httpError`.
export function showBootFailure(err: unknown): void {
    const root = document.getElementById("root");
    if (root == null)
        return;

    const e = err as {
        message?: string; stack?: string; url?: string;
        httpError?: { exceptionType?: string | null; exceptionMessage?: string | null; stackTrace?: string | null };
    } | null | undefined;

    const http = e?.httpError;
    const title = http?.exceptionType ?? (err instanceof Error ? err.name : null) ?? "Error";
    const message = http?.exceptionMessage ?? e?.message ?? String(err);
    // A JS stack repeats "Name: message" on its first line, which the heading above already shows.
    const rawDetail = http?.stackTrace ?? e?.stack ?? null;
    const detail = rawDetail?.startsWith(title + ": " + message)
        ? rawDetail.slice((title + ": " + message).length).trimStart()
        : rawDetail;

    root.textContent = "";

    const panel = document.createElement("div");
    panel.setAttribute("role", "alert");
    panel.style.cssText = "max-width:60rem;margin:3rem auto;padding:1.5rem 1.75rem;border:1px solid #dc3545;"
        + "border-radius:.5rem;font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;line-height:1.5";

    const heading = document.createElement("h1");
    heading.textContent = "eastwind could not start";
    heading.style.cssText = "font-size:1.25rem;margin:0 0 .75rem;color:#dc3545";
    panel.appendChild(heading);

    const first = document.createElement("p");
    first.textContent = title + ": " + message;
    first.style.cssText = "margin:0 0 .75rem;font-weight:600;white-space:pre-wrap";
    panel.appendChild(first);

    if (e?.url != null) {
        const where = document.createElement("p");
        where.textContent = "while calling " + e.url;
        where.style.cssText = "margin:0 0 .75rem;opacity:.75;font-size:.875rem";
        panel.appendChild(where);
    }

    // A request that never reached a server is the common case in development, and its message ("Internal
    // Server Error", which is what the vite proxy answers for a refused connection) says nothing about why.
    // The url is on the error for an ajax-layer throw and only inside the message for a hand-thrown one.
    if (e?.url?.startsWith("/api") == true || message.includes("/api/")) {
        const hint = document.createElement("p");
        hint.textContent = "The API did not answer. Is it running? `pnpm --filter eastwind stack local`"
            + " starts the server and the client together.";
        hint.style.cssText = "margin:0 0 .75rem;opacity:.75;font-size:.875rem";
        panel.appendChild(hint);
    }

    if (detail != null) {
        const pre = document.createElement("pre");
        pre.textContent = detail;
        pre.style.cssText = "margin:0;padding:.75rem;overflow:auto;max-height:20rem;font-size:.8125rem;"
            + "background:rgba(127,127,127,.12);border-radius:.375rem";
        panel.appendChild(pre);
    }

    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Retry";
    retry.style.cssText = "margin-top:1rem;padding:.375rem 1rem;border:1px solid currentColor;"
        + "border-radius:.375rem;background:transparent;color:inherit;cursor:pointer";
    retry.addEventListener("click", () => location.reload());
    panel.appendChild(retry);

    root.appendChild(panel);

    // Belt and braces: appending the panel already trips the splash's observer, but a failure that
    // happens with no #root content of its own must still uncover whatever there is.
    window.__hideAppSplash?.();
}
