// Frees the API port (default 3001, or $PORT) by killing whatever is listening on it, so a stale
// dev server from a previous `stack:*` / `server:*` run doesn't block a new one with EADDRINUSE.
// Zero-dependency and cross-platform (Windows netstat/taskkill, POSIX lsof/kill). Run directly
// (`pnpm free:port`) or as the first step of the stack scripts.
import { execSync } from "node:child_process";

const port = String(process.env.PORT ?? "3001");
const isWindows = process.platform === "win32";

function listeningPids() {
    try {
        if (isWindows) {
            const out = execSync("netstat -ano -p tcp", { encoding: "utf8" });
            const pids = new Set();
            for (const line of out.split("\n")) {
                // e.g. "  TCP    0.0.0.0:3001   0.0.0.0:0   LISTENING   18180"
                const m = line.match(new RegExp(`:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`));
                if (m) pids.add(m[1]);
            }
            return [...pids];
        }
        const out = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, { encoding: "utf8" });
        return out.split("\n").map(s => s.trim()).filter(Boolean);
    } catch {
        return []; // nothing listening → the command exits non-zero
    }
}

const pids = listeningPids();
if (pids.length === 0) {
    console.log(`[free-port] :${port} is free`);
} else {
    for (const pid of pids) {
        try {
            if (isWindows)
                execSync(`taskkill /PID ${pid} /F /T`, { stdio: "ignore" });
            else
                process.kill(Number(pid), "SIGKILL");
            console.log(`[free-port] freed :${port} (killed PID ${pid})`);
        } catch (e) {
            console.log(`[free-port] could not kill PID ${pid} on :${port}: ${e.message}`);
        }
    }
}
