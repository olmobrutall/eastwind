import type { Page } from "@playwright/test";
import { BrowserProxy } from "@altea/altea-playwright/BrowserProxy";

// eastwind's BrowserProxy — Signum's "inherit from BrowserProxy and override Url" (Southwind does exactly
// this in Southwind.Test.React). The base URL is the VITE dev server, overridable so the same suite can run
// against a deployed instance.
export class EastwindBrowser extends BrowserProxy {

    static baseUrl = process.env["EASTWIND_E2E_URL"] ?? "http://localhost:5173/";

    constructor(page: Page) { super(page); }

    override url(relativeUrl: string): string {
        return EastwindBrowser.baseUrl.replace(/\/+$/, "") + "/" + relativeUrl.replace(/^\/+/, "");
    }
}

/** The dev seed hashes each user's name as their password (see CLAUDE.md), so this is the whole login. */
export const testUser = { userName: "System", password: "System" };
