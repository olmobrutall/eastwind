import * as React from "react";
import { PaletteSelector, type Palette } from "@altea/altea/client/Components/PaletteSelector";

// The navbar palette picker. altea's PaletteSelector does the work (data-palette, the remembered choice);
// eastwind supplies the palettes, which are bundled in palettes.css — nothing is fetched when one is picked.
const PALETTES: Palette[] = [
    { name: "", label: "Default", swatch: "#0d6efd" },
    { name: "ocean", label: "Ocean", swatch: "#0e7490" },
    { name: "forest", label: "Forest", swatch: "#15803d" },
    { name: "rose", label: "Rose", swatch: "#e11d48" },
    { name: "amber", label: "Amber", swatch: "#b45309" },
    { name: "violet", label: "Violet", swatch: "#7c3aed" },
];

export function ThemeSelector(): React.ReactElement {
    return <PaletteSelector palettes={PALETTES} />;
}
