// Run one of the app's entry points against a named ENVIRONMENT.
//
//   pnpm --filter eastwind terminal dev        → node … --env-file=.env.dev dist/terminal/terminal.js
//   pnpm --filter eastwind server  live
//   pnpm --filter eastwind stack   local
//
// Why a wrapper at all: Node accepts `--env-file` only as a CLI flag (not through NODE_OPTIONS), so the
// environment cannot be threaded in as a plain variable — it has to be spliced into the command line.
// Without this there is one script per environment per entry point, which is how `stack:postgres` /
// `stack:sqlserver` / `stack:swpostgres` × terminal/server/stack became nine near-identical lines.
//
// The environment is REQUIRED: a missing one fails with the list of `.env.*` files actually present
// rather than silently starting against whatever `local` happens to hold. Pointing production tooling at
// a developer's database is exactly the accident a default would cause.
//
// Any extra arguments are forwarded to the target, so `pnpm --filter eastwind terminal dev sync` reaches
// the terminal's `sync` command.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The entry points, by target name. `run` returns the argv to spawn (or drives a sequence itself). */
const TARGETS = {
    terminal: {
        describe: "the loading / migration console",
        // `tspc -b` first, as the old terminal:* scripts did: the terminal runs compiled output.
        build: true,
        node: ["--enable-source-maps", "--import", "@altea/altea/register.mjs", "dist/terminal/terminal.js"],
    },
    "terminal-bundled": {
        describe: "the terminal from its single-file bundle (no ts-node register)",
        build: false,
        node: ["--enable-source-maps", "dist/terminal-bundle/main.js"],
    },
    server: {
        describe: "the API host alone",
        build: false,
        node: ["--enable-source-maps", "--import", "@altea/altea/register.mjs", "dist/webServer.server.js"],
    },
};

const [target, env, ...rest] = process.argv.slice(2);

if (target == null || !(target in TARGETS) && target !== "stack")
    fail(`Unknown target ${JSON.stringify(target ?? "")}.`,
        `Valid targets: ${[...Object.keys(TARGETS), "stack"].join(", ")}`);

if (env == null || env.startsWith("-"))
    fail(`No environment given.`,
        `Usage: pnpm --filter eastwind ${target} <environment> [args…]`,
        ...availableEnvironments());

const envFile = `.env.${env}`;
if (!fs.existsSync(path.join(appRoot, envFile)))
    fail(`${envFile} does not exist.`,
        `Copy .env.example to ${envFile} and fill it in.`,
        ...availableEnvironments());

if (target === "stack")
    await stack();
else
    await single(TARGETS[target]);

// ---- targets -------------------------------------------------------------------------------------

/** One entry point: optionally build, then run node with the env file spliced in. */
async function single(spec) {
    if (spec.build)
        await shell("pnpm run build:types");

    const entry = spec.node[spec.node.length - 1];
    await node([...spec.node.slice(0, -1), `--env-file=${envFile}`, entry, ...rest]);
}

/**
 * The three dev processes together (the old `stack:*`): the type watcher, the API and the vite client.
 * `-k` means one of them dying stops the other two, which is what makes Ctrl+C leave nothing behind.
 */
async function stack() {
    await shell("pnpm run build:types");
    await shell("pnpm run free:port");
    await shell(`pnpm exec concurrently -k -n types,api,client -c blue,green,magenta`
        + ` "pnpm run dev:types" "pnpm run server ${env}" "pnpm run dev:client"`);
}

// ---- plumbing ------------------------------------------------------------------------------------

/**
 * Node itself, with NO shell: `process.execPath` contains spaces on Windows ("C:\Program Files\…"),
 * which a shell would split on — the first version of this failed with "C:\Program is not recognized".
 */
function node(args) {
    return wait(spawn(process.execPath, args, { cwd: appRoot, stdio: "inherit" }));
}

/**
 * A workspace BINARY (pnpm, and through it tspc / concurrently). Those are `.cmd` shims on Windows,
 * which Node refuses to spawn without a shell — so this goes through one, as a single command STRING.
 * A string rather than command+args because `shell: true` with an args array neither escapes nor is
 * supported any more (DEP0190).
 */
function shell(command) {
    return wait(spawn(command, { cwd: appRoot, stdio: "inherit", shell: true }));
}

function wait(child) {
    return new Promise((resolve, reject) => {
        child.on("error", reject);
        child.on("exit", code => code === 0 ? resolve() : process.exit(code ?? 1));
    });
}

/** The `.env.*` files that exist, so a wrong name shows what is actually available. */
function availableEnvironments() {
    const found = fs.readdirSync(appRoot)
        .filter(f => f.startsWith(".env.") && f !== ".env.example")
        .map(f => f.slice(".env.".length))
        .sort();

    return found.length === 0
        ? [`No .env.* files found in ${appRoot}.`]
        : [`Available: ${found.join(", ")}`];
}

function fail(...lines) {
    for (const l of lines)
        console.error(l);
    process.exit(1);
}
