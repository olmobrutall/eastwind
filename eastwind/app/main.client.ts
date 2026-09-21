import "bootstrap/dist/css/bootstrap.min.css";
// react-widgets-up widget styles (DatePicker/DropdownList/Combobox/Multiselect used across the Lines
// and SearchControl, e.g. QueryTokenBuilder). Upstream imports the SCSS in MainPublic; sass isn't wired
// here, so we use the package's prebuilt CSS (CSS custom properties, --rw-*). After bootstrap so the
// .rw-* rules aren't overridden. Without this the pickers render unstyled.
import "react-widgets-up/styles.css";
// Framework app-shell styles — the
// `.sf-page-container` tinted background so content cards + their shadows read, modal sizing, etc. Loaded
// app-wide (not just on the entity-frame routes) so every page, including the search page, gets it.
import "@altea/altea/client/Frames/Frames.css";
// The visual-tip beat: the animation that marks a tip
// this user has not read yet. It honours prefers-reduced-motion.
import "@altea/altea/client/Basics/VisualTipIcon.css";
// The app's own stylesheet: the full-bleed hero the
// landing page and the public catalog render into. Last, so it wins over bootstrap.
import "./site.css";
import "./MainPublic.client"; // self-boots (Southwind's main.tsx -> MainPublic)
