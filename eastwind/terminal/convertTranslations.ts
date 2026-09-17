import { resolve } from "node:path";
import { TranslationLogic } from "@altea/altea-translations/server/TranslationLogic";

// Convert one Signum translation file into its altea counterpart, renaming the types through the shared
// dictionary — Signum's `SynchronizeTypes` with the prompt replaced by a file.
//
//   pnpm --filter eastwind terminal <env> convert-translations <source.xml> <target.xml> [dictionary]
//
// The dictionary defaults to terminal/translationRenames.txt, which is GLOBAL: one file for the whole
// port, framework packages and application alike. It is global because the question it answers — what did
// Signum call this type — has one answer per type, wherever the type ends up.
//
// The target is OVERWRITTEN, so point it at a file this source alone should define. A repeated key emits
// the snippet once per target; the first synchronization then drops whatever the receiving package does
// not declare, which is the cheap direction to be wrong in.

export async function convertTranslationsCommand(args: string[]): Promise<void> {
    const [source, target, dictionary] = args.filter(a => !a.startsWith("--"));
    if (source == undefined || target == undefined) {
        console.log("Usage: convert-translations <source.xml> <target.xml> [dictionary.txt]");
        return;
    }

    const dictionaryPath = resolve(dictionary ?? defaultDictionary());
    const r = TranslationLogic.convertFile(resolve(source), resolve(target), dictionaryPath);

    console.log(`[convert-translations] ${resolve(source)}`);
    console.log(`                    -> ${resolve(target)}`);
    console.log(`  dictionary: ${dictionaryPath}`);
    console.log(`  ${r.read} types read, ${r.renamed} renamed, ${r.duplicated} duplicated`);
    if (r.unmapped.length > 0)
        console.log(`  copied through unchanged (${r.unmapped.length}): ${r.unmapped.join(", ")}`);
    await Promise.resolve();
}

/** The global rename dictionary that ships with the terminal. */
function defaultDictionary(): string {
    return resolve(process.cwd(), "terminal", "translationRenames.txt");
}
