import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Client (SPA) bundle. Consumes the transformer-emitted JS of the core/spa
// layers (kept fresh by `tspc -b --watch`); Vite never runs the transformer.
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: "dist/client",
        emptyOutDir: true,
    },
});
