import * as React from "react";
import { NavDropdown } from "react-bootstrap";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "@altea/altea/data/globals/stringExtensions";

// The navbar PALETTE picker: any of the bootswatch themes, or the
// default bootstrap. It pairs with @altea/altea's ThemeModeSelector (light / dark / auto): picking a palette
// that is inherently dark dispatches the `change-theme-mode` event so the mode follows it.
//
// The stylesheet comes off the BOOTSWATCH CDN — a palette is a full bootstrap build, so
// bundling all 26 would be ~4 MB of CSS the app almost never uses, and nothing here is needed to run: with
// no network the picker simply fails to apply (a console error, the previous look kept) and the mode
// selector still works, since that one is pure CSS variables.
//
// Two things to know, both about WHICH stylesheet gets disabled while a palette is active:
//  - in DEV the base bootstrap arrives as vite's injected <style> for `bootstrap/dist/css/bootstrap.min.css`
//    (eastwind imports the prebuilt CSS in main.client.ts). An SCSS entry point would be looked up instead,
//    which is its SCSS entry point — there is no such file here.
//  - in a BUILD nothing is disabled, where a separately compiled
//    theme as a separate stylesheet; vite bundles eastwind's bootstrap import together with every other
//    imported stylesheet (Frames.css, Lines.css, site.css, …) into one file, so disabling it would take the
//    whole app's CSS with it. The palette is appended LAST instead and wins by cascade order — which also
//    means it wins over app rules that share a selector with bootstrap (`.modal-body`, say). Palette-picking
//    is a demo affordance, so that trade is worth naming rather than solving.
const BOOTSWATCH_THEMES: Record<string, "light" | "dark"> = {
    cerulean: "light",
    cosmo: "light",
    cyborg: "dark",
    darkly: "dark",
    flatly: "light",
    journal: "light",
    litera: "light",
    lumen: "light",
    lux: "light",
    materia: "light",
    minty: "light",
    morph: "light",
    pulse: "light",
    quartz: "light",
    sandstone: "light",
    simplex: "light",
    sketchy: "light",
    slate: "dark",
    solar: "dark",
    spacelab: "light",
    superhero: "dark",
    united: "light",
    vapor: "dark",
    yeti: "light",
    zephyr: "light",
};

const BOOTSWATCH_VERSION = "5.3.3";
const THEME_LINK_ID = "bootswatch-theme-css";
const STORAGE_KEY = "bootswatch-theme";

function setBootswatchTheme(theme: string): void {
    // The base bootstrap, as vite serves it in dev (see the divergences above; in a build this finds nothing).
    const devBootstrap = document.querySelector<HTMLStyleElement>('style[data-vite-dev-id*="bootstrap.min.css"]');

    if (!theme) {
        document.querySelectorAll(`link#${THEME_LINK_ID}`).forEach(el => el.remove());
        if (devBootstrap)
            devBootstrap.disabled = false;
        return;
    }

    const url = `https://cdn.jsdelivr.net/npm/bootswatch@${BOOTSWATCH_VERSION}/dist/${theme}/bootstrap.min.css`;

    // Load the new palette BEFORE dropping the old one, so the app is never unstyled mid-swap.
    const preload = document.createElement("link");
    preload.rel = "stylesheet";
    preload.href = url;

    preload.onload = (): void => {
        if (devBootstrap)
            devBootstrap.disabled = true;

        document.querySelectorAll(`link#${THEME_LINK_ID}`).forEach(el => el.remove());

        const link = document.createElement("link");
        link.id = THEME_LINK_ID;
        link.rel = "stylesheet";
        link.href = url;
        document.head.appendChild(link);

        preload.remove();
    };

    preload.onerror = (): void => {
        console.error(`Failed to load the bootswatch theme "${theme}" from ${url}`);
        preload.remove();
    };

    document.head.appendChild(preload);
}

export function ThemeSelector(): React.ReactElement {
    const [theme, setTheme] = React.useState(() => localStorage.getItem(STORAGE_KEY) ?? "");

    React.useEffect(() => {
        setBootswatchTheme(theme);
        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    function select(t: string): void {
        setTheme(t);
        // Tell the mode selector to follow a palette that is inherently dark / light.
        // Only when the palette HAS an opinion: "Default bootstrap" supports both, so it leaves the mode
        // alone rather than clobbering an explicit choice — falling back to "light" here would
        // silently undoes a picked dark mode.
        const mode = BOOTSWATCH_THEMES[t];
        if (mode != null)
            window.dispatchEvent(new CustomEvent("change-theme-mode", { detail: mode }));
    }

    return (
        <NavDropdown className="sf-theme-dropdown" data-theme={theme}
            title={<><FontAwesomeIcon icon="palette" /> {theme ? theme.firstUpper() : "Default"}</>}>
            <NavDropdown.Item data-theme="" active={theme === ""} onClick={() => select("")}>
                Default bootstrap
            </NavDropdown.Item>
            {Object.keys(BOOTSWATCH_THEMES).map(t =>
                <NavDropdown.Item key={t} data-theme={t} active={theme === t} onClick={() => select(t)}>
                    {t.firstUpper()}
                </NavDropdown.Item>
            )}
        </NavDropdown>
    );
}
