import { resolve } from "node:path";
import {
    portTranslations, formatPortReport, type TranslationPortRule,
} from "@altea/altea-translations/server/TranslationPort";

// The eastwind side of @altea/altea-translations' translation port: WHERE the Signum files are and WHAT
// this port renames. The mechanics are the tool's; only the two answers below are ours, and they are the
// two that no tool can infer.
//
//   pnpm --filter eastwind terminal <env> port-translations [sourceRoot] [--cultures=de,es] [--dry] [--full] [--overwrite]
//
// The default source root is the vendored Signum checkout under `old/`, which holds BOTH halves the port
// needs — `Framework/**` (the framework packages) and `Southwind/Translations` (the application) — so one
// run covers Signum → altea and Southwind → eastwind. They are one run because the destination is decided
// per TYPE, not per source file: whichever package the running process says declares a type is where its
// translation lands.

/** The rename/rewording rules. Everything a `@legacyClassName` already states is left out on purpose. */
const RULES: TranslationPortRule[] = [
    {
        // Signum.Word → @altea/altea-office-template. The TYPE names come from `@legacyClassName`; what is
        // left is the members that carry the old product name (`WordTemplateEntity.WordConverter` →
        // `officeConverter`) and the TEXT, which has to change rather than follow: an altea Office template
        // renders docx, pptx AND xlsx, so "Word-Vorlage" would now be wrong, not merely renamed.
        types: [/^Word/],
        identifiers: [[/Word/g, "Office"]],
        text: [[/\bWord\b/g, "Office"]],
        textByCulture: {
            // Signum's German file translates the product name in two places where it should not have been
            // translated at all ("Wortvorlage aus Wort-Modell erstellen"); both become Office here.
            de: [[/Wortvorlage/g, "Office-Vorlage"], [/Wort-Modell/g, "Office-Modell"], [/\bWort\b/g, "Office"]],
            // Spanish leaves the product name standing after the noun ("Plantilla Word"), so the plain
            // `\bWord\b` rule above already covers it; nothing language-specific is left.
        },
    },
];

/**
 * Types Signum and altea both have but under names neither `@legacyClassName` nor a rule connects —
 * altea restructurings rather than renames, which is why they have to be written out:
 *
 *  - an MList of embeddeds became a `@part` row entity named `<Owner>_<Field>`;
 *  - one Signum type covering two directories became one per directory.
 */
const TYPE_RENAMES: Record<string, string> = {
    // Signum's MList-embedded elements → altea `@part` rows.
    PanelPartEmbedded: "DashboardEntity_Part",
    TokenEquivalenceGroupEntity: "DashboardEntity_TokenEquivalenceGroup",
    EmailMasterTemplateMessageEmbedded: "EmailMasterTemplateEntity_Message",

    // Signum's one AD configuration/mapping, split per directory module in altea (BaseAD).
    // Only one of the two can receive the strings; the Azure one is the shared shape's better match.
    ActiveDirectoryConfigurationEmbedded: "AzureADConfigurationEmbedded",
    RoleMappingEmbedded: "AzureADRoleMappingEntity",

    // A user query's three MList embeddeds — each one a `@part` row of its owner in altea.
    QueryColumnEmbedded: "UserQueryEntity_Column",
    QueryOrderEmbedded: "UserQueryEntity_Order",
    QueryColumnHelpEmbedded: "QueryHelpEntity_Column",
    // …except the filter, which altea shares between every asset that filters, so it has a base of its own.
    QueryFilterEmbedded: "QueryFilterBaseEntity",

    // A toolbar's elements: one embedded in Signum, an abstract row base plus a concrete row in altea.
    // The shared members are the BASE's, which is where the translations belong.
    ToolbarElementEmbedded: "ToolbarElementBaseEntity",

    FilePathEntity: "FilePathEmbedded",

    // Southwind → eastwind: an order's lines are an MList of embeddeds there, a `@part` row entity here.
    OrderDetailEmbedded: "OrderLineEntity",
};

/**
 * Members altea renamed where the TYPE kept its name — so neither `@legacyClassName` (which is per type)
 * nor the casing convention connects them. Each one is a field that collided with something in altea and
 * had to move, not a translation decision.
 */
const MEMBER_RENAMES: Record<string, string> = {
    // `title` / `text` are COLUMNS on altea's AlertEntity, and the plain names went to the computed pair
    // that falls back to the alert type — so the stored fields carry the `Field` suffix.
    "AlertEntity.Title": "TitleField",
    "AlertEntity.Text": "TextField",
};

export async function portTranslationsCommand(args: string[]): Promise<void> {
    const positional = args.filter(a => !a.startsWith("--"));
    const sourceRoot = resolve(positional[0] ?? defaultSourceRoot());
    const culturesArg = args.find(a => a.startsWith("--cultures="))?.slice("--cultures=".length);

    const report = portTranslations({
        sourceRoot,
        cultures: culturesArg ? culturesArg.split(",").map(c => c.trim()).filter(Boolean) : ["de", "es"],
        typeRenames: TYPE_RENAMES,
        memberRenames: MEMBER_RENAMES,
        rules: RULES,
        overwrite: args.includes("--overwrite"),
        dryRun: args.includes("--dry"),
    });

    console.log(`[port-translations] source: ${sourceRoot}${args.includes("--dry") ? " (dry run)" : ""}`);
    console.log(formatPortReport(report, args.includes("--full") ? Number.MAX_SAFE_INTEGER : 30));
    await Promise.resolve();
}

/** `old/` — the vendored Signum + Southwind checkout this repository ports from. */
function defaultSourceRoot(): string {
    return resolve(process.cwd(), "..", "old");
}
