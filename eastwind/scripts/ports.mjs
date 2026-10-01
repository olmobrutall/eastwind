// THE ONE PLACE THE DEVELOPMENT PORTS ARE DECLARED.
//
// Two processes bind a port in development: the API host (webServer.server.ts) and the vite dev server
// that serves the SPA and proxies /api through to it. Both numbers used to be written out at every call
// site — the vite config, the port-freeing script, the Playwright base URL, both launch.json files and
// the docs — so moving them meant finding eight literals, and a clone of this application that wanted to
// run BESIDE the original had to edit all eight.
//
// Now they are declared here once and OVERRIDDEN PER CLONE from the environment file, which is already
// the per-clone file (`.env.<environment>` is gitignored in an application cloned from this one):
//
//     PORT=3011           # the API host
//     CLIENT_PORT=5183    # the vite dev server
//
// Precedence is: the real process environment (the launcher splices the chosen `.env.<environment>` in —
// see withEnv.mjs) → eastwind/.env.local → the defaults below. The middle step exists because `pnpm
// dev:client` and VS Code's "eastwind client (vite dev)" start vite WITHOUT an env file, and vite's own
// convention — the one `.env.local` already documents for VITE_* flags — is the file to read.
//
// Nothing here picks a FREE port. A dev server that silently moves to the next port (vite's default, and
// how `stack` came to answer on :5174) breaks everything that addresses it by number — the Playwright
// base URL, the seeded email `urlLeft`, a bookmark — without saying so. `strictPort` plus `free:port`
// means the stack either owns these ports or fails naming them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** The API host. 3001, not 3000: a local Signum dev host commonly occupies 3000, so eastwind sits beside it. */
export const DEFAULT_API_PORT = 3001;
/** The vite dev server — vite's own default, kept so the familiar URL still works out of the box. */
export const DEFAULT_CLIENT_PORT = 5173;

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The two development ports, resolved as documented above.
 * @param {NodeJS.ProcessEnv} [env] the environment to read; defaults to this process's.
 * @param {string} [envFileName] which `.env.*` to fall back to. `.env.local` is right for anything
 *   started WITHOUT a named environment (vite, which has no `--env-file`); withEnv.mjs passes the file
 *   the run actually named, so `stack dev` takes `.env.dev`'s ports and not `.env.local`'s.
 * @returns {{ apiPort: number, clientPort: number, apiTarget: string, clientUrl: string }}
 */
export function devPorts(env = process.env, envFileName = ".env.local") {
    const local = readEnvFile(path.join(APP_ROOT, envFileName));
    const pick = (name, fallback) => toPort(env[name]) ?? toPort(local[name]) ?? fallback;

    const apiPort = pick("PORT", DEFAULT_API_PORT);
    const clientPort = pick("CLIENT_PORT", DEFAULT_CLIENT_PORT);

    return {
        apiPort,
        clientPort,
        // What the vite proxy forwards /api (and the server-rendered paths) to. VITE_API_TARGET still wins,
        // because it is the one that also points at a host that is not localhost.
        apiTarget: env["VITE_API_TARGET"] ?? local["VITE_API_TARGET"] ?? `http://localhost:${apiPort}`,
        clientUrl: `http://localhost:${clientPort}`,
    };
}

/** @param {string | undefined} value */
function toPort(value) {
    if (value == null || value.trim() === "")
        return undefined;
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 65535)
        throw new Error(`Not a port number: ${JSON.stringify(value)}`);
    return n;
}

/**
 * The `KEY=value` lines of an env file, or `{}` if it is not there. Deliberately NOT `process.loadEnvFile`:
 * that one MUTATES process.env, which would let a file override a value the launcher deliberately set.
 * @returns {Record<string, string>}
 */
function readEnvFile(file) {
    /** @type {Record<string, string>} */
    const result = {};
    if (!fs.existsSync(file))
        return result;

    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m == null)
            continue; // blank, or a `#` comment — which is how an env file carries its documentation
        // Strip a trailing `# comment`, then matching quotes. The env files here write both
        // (`DB_ENVIRONMENT=Test      # which ApplicationConfiguration row this process runs as`).
        let value = m[2].replace(/\s+#.*$/, "").trim();
        if (value.length >= 2 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0])
            value = value.slice(1, -1);
        result[m[1]] = value;
    }
    return result;
}
