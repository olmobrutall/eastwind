// Node ESM resolver hook for running the tspc-emitted JS directly.
//
// altea/eastwind are compiled with moduleResolution "bundler", so their emitted dist/*.js
// use extensionless relative imports (e.g. `./sync/sqlBuilder`) — but Node's ESM loader requires explicit extensions.
// This hook retries a failed extensionless specifier as `.js` then `/index.js`, so
// `node` can run the compiled output without a bundling step. The `/index.js`
// retry also covers folder barrels (e.g. `../entities/globals` → `globals/index.js`),
// which Node rejects with ERR_UNSUPPORTED_DIR_IMPORT rather than ERR_MODULE_NOT_FOUND.
export async function resolve(specifier, context, nextResolve) {
    try {
        return await nextResolve(specifier, context);
    } catch (err) {
        if (err?.code !== "ERR_MODULE_NOT_FOUND" && err?.code !== "ERR_UNSUPPORTED_DIR_IMPORT") throw err;
        const hasExt = /\.[mc]?js$/.test(specifier);
        if (hasExt || !(specifier.startsWith(".") || specifier.startsWith("/") || /^[a-zA-Z]:/.test(specifier)))
            throw err;
        for (const cand of [specifier + ".js", specifier + "/index.js"]) {
            try { return await nextResolve(cand, context); } catch { /* try next */ }
        }
        throw err;
    }
}
