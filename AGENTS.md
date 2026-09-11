# AI agent instructions for eastwind

**Read [`altea/AGENTS.md`](altea/AGENTS.md) first** — it holds every altea framework convention (entities,
queries, operations, registration, React components, localization, build and test).

This file only covers eastwind-specific details.

---

## Repo layout

```
altea/          the framework, as a git submodule — ~50 workspace packages (@altea/altea + the modules)
eastwind/       this application
old/            Signum + Southwind, read-only — the sources eastwind was ported from
```

`pnpm-workspace.yaml` lists every altea package plus `eastwind`; external dependencies are hoisted to the
workspace-root `node_modules` (`nodeLinker: hoisted`).

**Do not modify `altea/` for something only eastwind needs** — it is a submodule, and a change there
reaches every application. `old/` is read-only.

## Project structure

```
eastwind/
  <domain>/       one folder per domain — customers, employees, orders, products, shippers, departments
                    <Domain>.data.ts          entities, enums, operation symbols, messages
                    <Domain>Logic.server.ts   sb.include(…) / queries / operations / tasks
                    <Domain>Client.client.ts  cb.configure(…) client registration
                    <Domain>.tsx              the entity's view
  globals/        the ApplicationConfiguration row every module's settings live on, + its view
  publicApi/      the anonymous surface: the public catalog and self-service registration
  client/…        MainPublic / MainAdmin / Layout / Home  (at the app root)
  server/…        webServer.server.ts + starter.server.ts (at the app root)
  terminal/       the loading / migration console
  test/           Playwright e2e suites, driven through @altea/altea-playwright
  translations/   the app's own Eastwind.<culture>.xml
  port/           what this app carries only because it was PORTED — see below
  Modules.xml     which modules are optional, and how to remove one
```

A domain folder names its registration modules after their ROLE: `OrderLogic.server.ts`, not
`Order.server.ts`; `OrderClient.client.tsx`, not `Order.client.tsx`. The base name alone should say what
the module is, because that is all a tab strip, a stack trace or a fuzzy-finder hit shows. The prefix stays
singular even where the exported namespace is plural (`OrdersLogic`).

## Key files

| File | What it is |
| --- | --- |
| `eastwind/starter.server.ts` | Central bootstrapping. Builds the schema, binds the connector, starts every module. |
| `eastwind/MainAdmin.client.ts` | Starts every module's CLIENT (the full, logged-in bundle). |
| `eastwind/MainPublic.client.tsx` | The SPA bootstrap: builds the route table for whoever is logged in, then the React root. |
| `eastwind/entityOverrides.data.ts` | Mixins, lite models and `implementedBy` widenings — applied on BOTH tiers, before anything is (de)serialized. |
| `eastwind/Layout.tsx` | The application shell (navbar, sidebar, modals). |
| `eastwind/globals/ApplicationConfiguration.data.ts` | The settings singleton every module's configuration lambda reads. |
| `eastwind/Modules.xml` | Which modules are optional and exactly how to remove each one. |
| `eastwind/docs/Wiring.md` | Why each module start is where it is. **Read before moving one.** |

### The three bootstrap files stay THIN

`starter.server.ts`, `MainAdmin.client.ts` and `MainPublic.client.tsx` are one line per module, in
DEPENDENCY ORDER (framework → each altea module after the ones it builds on → this app's own domains
last), in banner-separated tiers, with at most a couple of comment lines each. The long-form "why is this
call here" rationale lives in [`eastwind/docs/Wiring.md`](eastwind/docs/Wiring.md) — add to that file
rather than growing the call sites back.

Each multi-line module block ends with a trailing `//<ModuleName>` comment on its closing line. Those look
like noise and are **load-bearing**: they are the anchors `Modules.xml` spans match on. Run
`pnpm --filter eastwind check:modules` after touching any of those files.

## Domain model

Northwind: **Customers** (`Person` / `Company`, polymorphic under an abstract `CustomerEntity`),
**Orders** (state machine: New → Ordered → Shipped | Canceled, with `OrderLine` rows), **Products** (with
`Category` and `Supplier`), **Employees**, **Shippers**, **Departments** (a tree).
`ApplicationConfigurationEntity` is the global settings singleton, one row per environment.

## Build, run and test

Every entry point takes the ENVIRONMENT as an argument. There is no default — a missing one fails with the
list of `.env.*` files present, so nothing can start against the wrong database by omission.

```bash
pnpm --filter eastwind build:types              # tspc -b  (builds altea + eastwind)
pnpm --filter eastwind stack local              # types watcher + API + vite client, together
pnpm --filter eastwind server dev               # the API alone
pnpm --filter eastwind terminal test sync       # the console; extra args reach its commands
pnpm --filter eastwind test:e2e                 # Playwright, against a RUNNING stack
pnpm --filter eastwind check:modules            # validate Modules.xml against the sources
```

`stack` opens the client on **http://localhost:5173** and the API on **3001** (3000 is left free for a
local Signum host; override with `PORT`, and `VITE_API_TARGET` for the proxy). `-k` means if one process
dies the whole stack stops.

`test:e2e` is `tspc -b && playwright test`, and the build is not optional: a spec addresses lines with
property LAMBDAS, which only work once the quote-transformer has stamped them — so Playwright runs the
COMPILED specs (`testDir: dist/test`). First run on a machine: `npx playwright install chromium`.

### Environments

`.env.example` is the tracked TEMPLATE and documents every variable. Copy it to `.env.<environment>`;
eastwind ships `local` / `dev` / `test` / `live`. **Every `.env.<environment>` is git-ignored** — the
project copier still copies them into a new application, they are simply never part of a commit.

Only what cannot live in the database is in there: a connection, a credential, or a choice made while the
schema is BUILT. Every module's SETTINGS are members of the one `ApplicationConfiguration` row, edited at
`/view/ApplicationConfiguration`.

### Password-less dev login

The dev seed hashes each user's name as their password, so on a local database the password field is pure
friction. `VITE_PASSWORD_IS_USERNAME=true` in `.env.local` (vite reads that file in every mode) drops the
password input and sends the user name as the password — so `System`, `Steven`, `Anne`, … are each one
field away, and switching roles is just another login.

It is a **client-side convenience only**: the request is the normal `/api/auth/login`, so the server has no
bypass and every auth rule applies. The flag is read behind `import.meta.env.DEV`, which Vite replaces
statically, so it is dead code in a production build.

## Starting a NEW application from this one

```bash
pnpm --filter @altea/altea-clone start -- --name northbreeze   # or the altea-clone binary
cd ../northbreeze
altea-simplify                     # untick what you do not need; one commit per module
pnpm install
pnpm --filter quote-transformer build
pnpm --filter northbreeze build:types
```

`altea-clone` creates a fresh git repository, adds the `altea` submodule pinned to the same commit this
workspace has, and copies the application renamed in file names AND in content. `altea-simplify` then
removes the optional modules, following `eastwind/Modules.xml` — including the `port` module, which is
`optional="true"` and therefore dropped by default. Both live in `altea/cli/`; see
[`altea/cli/README.md`](altea/cli/README.md).

## The `port/` folder

`eastwind/port/` holds what this application carries only because it was ported from Southwind — the
ledger of app-level divergences, and the reasoning behind the legacy-mode machinery. `Modules.xml` has a
`port` module that removes it (with the probe scripts and the legacy `.env.*` files); it is
`optional="true"`, so a new application built from eastwind drops it by default.

`LegacyMode=true` in the environment points this build at a database a SIGNUM application generated, so
`terminal sync` reads as a migration rather than a rebuild. It is a RUNTIME switch and unrelated to
`Modules.xml`, which removes code at scaffold time — see the last section of `eastwind/docs/Wiring.md`.
