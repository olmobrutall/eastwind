// Ambient module declarations so `import './X.css'` (e.g. bootstrap's stylesheet) type-checks under
// tsc. The bundler (Vite) handles the actual CSS at build time.
declare module '*.css';
declare module '*.scss';
