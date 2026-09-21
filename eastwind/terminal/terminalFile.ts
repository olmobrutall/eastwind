import * as path from "node:path";
import * as url from "node:url";

/**
 * Resolve a data file that ships beside the terminal's SOURCE — `AuthRules.xml` and `UserAssets.xml` at
 * the root, and everything the demo data is made of under `northwind/` (the two `Northwind.*.sql`
 * scripts, `passagesWithEmbeddings.json`, the `image_*` folders), named with that first segment.
 *
 * They are resolved off this module's own location rather than the CWD, so the cwd does not matter:
 * the compiled module sits in `dist/terminal/`, hence `../../terminal`. `import.meta.url` — and not
 * `import.meta.dirname` — because that is the spelling the terminal bundle's `pinImportMetaUrl` rewrites
 * back to this file's pre-bundle location (see vite.emittedJs.ts); a bundled read would otherwise resolve
 * against `dist/terminal-bundle/`.
 */
export function terminalFile(...segments: string[]): string {
    return path.resolve(url.fileURLToPath(new URL(".", import.meta.url)), "../../terminal", ...segments);
}
