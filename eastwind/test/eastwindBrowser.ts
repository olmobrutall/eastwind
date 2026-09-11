import type { Page } from "@playwright/test";
import { BrowserProxy } from "@altea/altea-playwright/BrowserProxy";
import { baseUrl } from "./appStack";

// eastwind's BrowserProxy — Signum's "inherit from BrowserProxy and override Url" (Southwind does exactly
// this in Southwind.Test.React). The base URL is the stack under test (the vite dev server by default,
// overridable with EASTWIND_URL so the same suite can run against a deployed instance).
export class EastwindBrowser extends BrowserProxy {

    constructor(page: Page) { super(page); }

    override url(relativeUrl: string): string {
        return baseUrl() + relativeUrl.replace(/^\/+/, "");
    }

    /** The dev seed hashes each user's name as their password, so the name is the whole credential. */
    loginAs(userName: string): Promise<void> {
        return this.login(userName, userName);
    }
}
