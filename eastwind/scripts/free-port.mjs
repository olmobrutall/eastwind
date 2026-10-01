// Frees the DEVELOPMENT PORTS — the API host and the vite dev server — by killing whatever is listening
// on them, so a stale process from a previous `stack` / `server` run, a hard-stopped debug session, or an
// editor-spawned preview does not block a new stack.
//
// BOTH ports, not just the API's: vite does not fail on a taken port by default, it moves to the next one,
// and a stack whose client quietly answered on :5174 is how this script came to need a second half. (The
// vite config now sets `strictPort`, so it says so instead — this is what keeps it from having to.)
//
// The numbers come from scripts/ports.mjs (PORT / CLIENT_PORT, per clone). Zero-dependency and
// cross-platform (Windows netstat/taskkill, POSIX lsof/kill). Run directly (`pnpm free:port`) or as a
// step of the stack scripts.
import { execSync } from "node:child_process";
import { devPorts } from "./ports.mjs";

const { apiPort, clientPort } = devPorts();
const isWindows = process.platform === "win32";

for (const [label, port] of [["api", apiPort], ["client", clientPort]])
    free(label, String(port));

function free(label, port) {
    const pids = listeningPids(port);
    if (pids.length === 0) {
        console.log(`[free-port] ${label} :${port} is free`);
        return;
    }
    for (const pid of pids) {
        try {
            if (isWindows)
                execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
            else
                process.kill(Number(pid), "SIGKILL");
            console.log(`[free-port] freed ${label} :${port} (killed PID ${pid})`);
        } catch (e) {
            console.log(`[free-port] could not kill PID ${pid} on ${label} :${port}: ${e.message}`);
        }
    }
}

function listeningPids(port) {
    try {
        if (isWindows) {
            // NO `-p tcp`: that flag means TCP over IPv4 ONLY, and vite binds the IPv6 loopback — a dev
            // server left over from a previous run sits on `[::1]:5173`, which `netstat -ano -p tcp` does
            // not list AT ALL. This script therefore reported the port free, vite then found it taken, and
            // (before `strictPort`) moved to :5174 without anyone being told. Plain `netstat -ano` lists
            // both families.
            const out = execSync("netstat -ano", { encoding: "utf8" });
            const pids = new Set();
            for (const line of out.split("\n")) {
                //   "  TCP    0.0.0.0:3001   0.0.0.0:0   LISTENING   18180"
                //   "  TCP    [::1]:5173     [::]:0      LISTENING    9996"
                const [proto, local, , state, pid] = line.trim().split(/\s+/);
                if (proto !== "TCP" || state !== "LISTENING" || pid == null)
                    continue;
                // The LAST colon: an IPv6 address is full of them.
                if (local.slice(local.lastIndexOf(":") + 1) === port)
                    pids.add(pid);
            }
            return [...pids];
        }
        const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
        return out.split("\n").map(s => s.trim()).filter(Boolean);
    } catch {
        return []; // nothing listening → the command exits non-zero
    }
}
