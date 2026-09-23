import { WebBuilder, CustomType } from "@altea/altea/server/webApi";
import type { EastwindMode } from "../eastwindMode.data";

/**
 * Serves the app's deployment MODE to its own client.
 *
 * The flag lives in the server's environment, and it is decided while the schema is built — but the client
 * needs it too, because `EntityOverrides` runs on BOTH tiers and an `implementedBy` list decides what the
 * editor offers as well as what tables exist. Duplicating it as a `VITE_` variable would let the two drift,
 * and a client that thinks a module is installed when the server does not registers pages whose API 404s.
 *
 * ANONYMOUS, and it must be: the client reads it during boot, before anyone has logged in. It reveals only
 * which module set this deployment runs, which the rendered navigation shows anyway.
 */
export namespace GlobalsServer {
    export function start(ws: WebBuilder, mode: EastwindMode): void {
        ws.get("/api/eastwind/appMode",
            { res: CustomType<EastwindMode>(), allowAnonymous: true },
            (_req, res) => { res.jsonTyped(mode); });
    }
}
