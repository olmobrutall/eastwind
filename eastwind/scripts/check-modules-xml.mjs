// Validate eastwind/Modules.xml against the sources it describes.
//
// Modules.xml removes LINES and SPANS by text, so it rots silently: rename a module's start call, drop a
// `//<Name>` anchor, move a file, and the wizard that scaffolds a new application produces something that
// does not compile — with no error until someone actually unticks that module. This is the cheap check.
//
//   node scripts/check-modules-xml.mjs        (from eastwind/, or `pnpm --filter eastwind check:modules`)
//
// It verifies, per <Module>:
//   - the XML is well-formed;
//   - every DependsOn names a module that exists;
//   - every RemoveFiles path exists;
//   - every Line= / From= / To= / Span= occurs in the file it names;
//   - a Line= matches a WHOLE line (Signum's RemoveLine is trimmed equality, not a prefix);
//   - a From/To span is ordered and not implausibly long (a too-generic From anchor silently swallows
//     half the file — that is how the Tour block first came out at 88 lines).
//
// It does NOT perform the removal or check that the result compiles.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { XMLParser, XMLValidator } from "fast-xml-parser";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Paths inside Modules.xml are relative to the REPOSITORY root, one level above the app.
const repoRoot = path.resolve(appRoot, "..");
const xmlPath = path.join(appRoot, "Modules.xml");

const MAX_SPAN_LINES = 60;

const xml = fs.readFileSync(xmlPath, "utf8");
const valid = XMLValidator.validate(xml);
if (valid !== true) {
    console.error(`Modules.xml is not well-formed: ${JSON.stringify(valid)}`);
    process.exit(1);
}

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    // Every element except the four containers is a repeatable directive.
    isArray: (name, _jpath, _leaf, isAttribute) =>
        !isAttribute && !["File", "Modules", "Projects", "Workspaces"].includes(name),
});

const doc = parser.parse(xml);
const modules = doc.File.Modules.Module;
const moduleNames = new Set(modules.map(m => m["@Name"]));

const lineCache = new Map();
function readLines(relative) {
    if (!lineCache.has(relative)) {
        const full = path.join(repoRoot, relative);
        lineCache.set(relative, fs.existsSync(full) && fs.statSync(full).isFile()
            ? fs.readFileSync(full, "utf8").split(/\r?\n/)
            : null);
    }
    return lineCache.get(relative);
}

const problems = [];
const report = (module, message) => problems.push(`[${module}] ${message}`);

for (const name of [...moduleNames].filter(n => modules.filter(m => m["@Name"] === n).length > 1))
    report(name, "declared more than once");

for (const module of modules) {
    const name = module["@Name"];

    for (const dep of String(module["@DependsOn"] ?? "").split(",").filter(Boolean))
        if (!moduleNames.has(dep))
            report(name, `DependsOn names no such module: ${dep}`);

    for (const kind of ["RemoveFiles", "RemoveLine", "RemoveSpanInLines", "ReplaceSpanInLines"]) {
        for (const directive of module[kind] ?? []) {
            const relative = directive["@Path"];
            if (relative == null)
                continue;

            for (const dep of String(directive["@DependsOn"] ?? "").split(",").filter(Boolean))
                if (!moduleNames.has(dep))
                    report(name, `<${kind}> DependsOn names no such module: ${dep}`);

            if (kind === "RemoveFiles") {
                if (!fs.existsSync(path.join(repoRoot, relative)))
                    report(name, `<RemoveFiles> path does not exist: ${relative}`);
                continue;
            }

            const lines = readLines(relative);
            if (lines == null) {
                report(name, `<${kind}> file does not exist: ${relative}`);
                continue;
            }

            const line = directive["@Line"], from = directive["@From"],
                to = directive["@To"], span = directive["@Span"];

            for (const [attr, needle] of [["Line", line], ["From", from], ["To", to], ["Span", span]])
                if (needle != null && !lines.some(l => l.includes(needle)))
                    report(name, `${relative}: no line contains ${attr}=${JSON.stringify(needle)}`);

            if (line != null && !lines.some(l => l.trim() === line.trim()))
                report(name, `${relative}: Line= matches only part of a line (RemoveLine is whole-line): `
                    + JSON.stringify(line));

            // A From= that matches SEVERAL lines silently anchors on the FIRST one, which is how a
            // two-line `if (!legacyMode)` anchor once swallowed an unrelated block above it.
            if (from != null && lines.filter(l => l.includes(from)).length > 1)
                report(name, `${relative}: From= matches `
                    + `${lines.filter(l => l.includes(from)).length} lines — the anchor is ambiguous: `
                    + JSON.stringify(from));

            if (from != null && to != null) {
                const start = lines.findIndex(l => l.includes(from));
                const end = lines.findIndex((l, i) => i >= start && l.includes(to));
                if (start >= 0 && end < 0)
                    report(name, `${relative}: To= never occurs at or after From=: ${JSON.stringify(to)}`);
                else if (start >= 0 && end - start + 1 > MAX_SPAN_LINES)
                    report(name, `${relative}: span From=${JSON.stringify(from)} is `
                        + `${end - start + 1} lines — the anchor is probably too generic`);
            }
        }
    }
}

if (problems.length > 0) {
    console.error(problems.join("\n"));
    console.error(`\nModules.xml: ${problems.length} problem(s) over ${modules.length} modules.`);
    process.exit(1);
}

console.log(`Modules.xml: OK — ${modules.length} modules, every anchor resolves.`);
