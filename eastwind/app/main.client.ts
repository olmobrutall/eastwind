import "@altea/altea/client/ui/fontAwesome";
import "@altea/altea/client/ui/semantic.css";
// Framework app-shell styles — the
// `.sf-page-container` tinted background so content cards + their shadows read, modal sizing, etc. Loaded
// app-wide (not just on the entity-frame routes) so every page, including the search page, gets it.
import "@altea/altea/client/Frames/Frames.css";
// The visual-tip beat: the animation that marks a tip
// this user has not read yet. It honours prefers-reduced-motion.
import "@altea/altea/client/Basics/VisualTipIcon.css";
// The app's own stylesheets (the `app` layer, above every framework rule): the full-bleed hero the landing page
// and the public catalog render into, and the palettes the navbar's picker offers.
import "./site.css";
import "./palettes.css";
import "./tailwind.css";
import "./MainPublic.client"; // self-boots
