import * as path from "node:path";
import * as url from "node:url";

/**
 * Resolve a data file that ships beside the terminal's SOURCE — `AuthRules.xml`, `UserAssets.xml`,
 * `passagesWithEmbeddings.json`, the two `Northwind.*.sql` scripts, the `image_*` folders.
 *
 * Signum reads these relative to the CWD (Southwind.Terminal names them "../../../AuthRules.xml" from its
 * bin folder). Here they are resolved off this module's own location instead, so the cwd does not matter:
 * the compiled module sits in `dist/terminal/`, hence `../../terminal`. `import.meta.url` — and not
 * `import.meta.dirname` — because that is the spelling the terminal bundle's `pinImportMetaUrl` rewrites
 * back to this file's pre-bundle location (see vite.emittedJs.ts); a bundled read would otherwise resolve
 * against `dist/terminal-bundle/`.
 */
export function terminalFile(...segments: string[]): string {
    return path.resolve(url.fileURLToPath(new URL(".", import.meta.url)), "../../terminal", ...segments);
}
