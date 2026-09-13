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

Southwind splits the deployment units into sibling PROJECTS (`Southwind`, `Southwind.Server`,
`Southwind.Terminal`, `Southwind.Test.*`) and the domains into folders inside the first. eastwind is one
pnpm package, so the deployment units are tsconfig PROJECTS instead — `terminal` and `test` are reserved
names the altea presets exclude from the data/server/client programs — and `app/` holds everything they
are built from, so no functional folder is a sibling of the tooling.

```
eastwind/
  app/            THE APPLICATION — what a browser and the API host run
    <domain>/       one folder per domain — customers, employees, orders, products, shippers, departments
                      <Domain>.data.ts          entities, enums, operation symbols, messages
                      <Domain>Logic.server.ts   sb.include(…) / queries / operations / tasks
                      <Domain>Client.client.ts  cb.configure(…) client registration
                      <Domain>.tsx              the entity's view
    globals/        the ApplicationConfiguration row every module's settings live on, + its view
    publicApi/      the anonymous surface: the public catalog and self-service registration
    starter.server.ts / webServer.server.ts     the server: schema + module starts, then the host
    MainPublic.client.tsx / MainAdmin.client.ts / Layout.tsx / Home.tsx / main.client.ts   the SPA
    entityOverrides.data.ts                     mixins and widenings, applied on BOTH tiers
  terminal/       the loading / migration console      (Southwind.Terminal)
  test/           environment / logic / playwright     (Southwind.Test.*)
  migrations/     the versioned .sql files — empty in a template application
  translations/   the app's own Eastwind.<culture>.xml — read from the package root at boot
  docs/           Wiring.md (why each module start is where it is) + Port.md (see below)
  scripts/        withEnv.mjs and friends, the entry point of every package.json script
  public/         vite's static directory — must sit beside index.html
  index.html      the SPA document; a build entry, like the vite and tsconfig files beside it
  env.d.ts        ambient declarations; the client preset globs `*.d.ts` at the ROOT only
  Modules.xml     which modules are optional, and how to remove one
```

A domain folder names its registration modules after their ROLE: `OrderLogic.server.ts`, not
`Order.server.ts`; `OrderClient.client.tsx`, not `Order.client.tsx`. The base name alone should say what
the module is, because that is all a tab strip, a stack trace or a fuzzy-finder hit shows. The prefix stays
singular even where the exported namespace is plural (`OrdersLogic`).

## Key files

| File | What it is |
| --- | --- |
| `eastwind/app/starter.server.ts` | Central bootstrapping. Builds the schema, binds the connector, starts every module. |
| `eastwind/app/MainAdmin.client.ts` | Starts every module's CLIENT (the full, logged-in bundle). |
| `eastwind/app/MainPublic.client.tsx` | The SPA bootstrap: builds the route table for whoever is logged in, then the React root. |
| `eastwind/app/entityOverrides.data.ts` | Mixins, lite models and `implementedBy` widenings — applied on BOTH tiers, before anything is (de)serialized. |
| `eastwind/app/Layout.tsx` | The application shell (navbar, sidebar, modals). |
| `eastwind/app/globals/ApplicationConfiguration.data.ts` | The settings singleton every module's configuration lambda reads. |
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
pnpm --filter eastwind build              # tspc -b  (builds altea + eastwind)
pnpm --filter eastwind stack local              # types watcher + API + vite client, together
pnpm --filter eastwind server dev               # the API alone
pnpm --filter eastwind terminal test sync       # the console; extra args reach its commands
pnpm --filter eastwind gen:environment local    # (re)build the TEST database + its snapshot — DESTRUCTIVE
pnpm --filter eastwind test local               # Playwright, against a RUNNING stack
pnpm --filter eastwind check:modules            # = altea-simplify --check
```

`stack` opens the client on **http://localhost:5173** and the API on **3001** (3000 is left free for a
local Signum host; override with `PORT`, and `VITE_API_TARGET` for the proxy). `-k` means if one process
dies the whole stack stops.

`test` builds first, and that is not optional: a spec addresses lines, columns and filters with property
LAMBDAS, which only mean something once the quote-transformer has stamped them — so Playwright runs the
COMPILED specs (`testDir: dist/test`). First run on a machine: `npx playwright install chromium`.

### The test database

The suite drives the browser AND the database: a test creates its order through `OrderOperation`, then
navigates to it. Both ends are the environment named on the command line — the one the running stack is
serving — so `test local` works against `.env.local`, as Signum's Southwind.Test.React works against its
dev database.

`gen:environment` builds that database once: a full generation, the roles + `AuthRules.xml` +
`UserAssets.xml` the terminal also applies, and then the TEST data (`test/environment/`) — three employees,
five users, two products, three customers, one shipper — rather than the terminal's whole Northwind import.
It leaves a SNAPSHOT behind (a database snapshot on SQL Server, a `<db>_Template` database on PostgreSQL),
and every test rewinds to it before it runs. So a spec creates rows freely and never cleans up — and the
local database ends up holding the test fixture, not the Northwind demo data.

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
node altea/cli/altea-clone/dist/main.js --name northbreeze
cd ../northbreeze
node <altea>/cli/altea-simplify/dist/main.js   # untick what you do not need; one commit per module
pnpm install
pnpm --filter quote-transformer build
pnpm --filter northbreeze build
```

`altea-clone` creates a fresh git repository, adds the `altea` submodule pinned to the same commit this
workspace has, and copies the application renamed in file names AND in content. `altea-simplify` then
removes the optional modules, following `eastwind/Modules.xml` — including the `port` module, which is
`optional="true"` and therefore dropped by default. Both live in `altea/cli/`; see
[`altea/cli/README.md`](altea/cli/README.md).

## The port ledger

[`eastwind/docs/Port.md`](eastwind/docs/Port.md) holds what this application carries only because it was
ported from Southwind — the ledger of app-level divergences, and the reasoning behind the legacy-mode
machinery. It is the app-level counterpart of the submodule's [`altea/port/`](altea/port), which keeps one
such file per framework module. `Modules.xml` has a `port` module that removes it (with the probe scripts
and the legacy `.env.*` files); it is `optional="true"`, so a new application built from eastwind drops it
by default.

`LegacyMode=true` in the environment points this build at a database a SIGNUM application generated, so
`terminal sync` reads as a migration rather than a rebuild. It is a RUNTIME switch and unrelated to
`Modules.xml`, which removes code at scaffold time — see the last section of `eastwind/docs/Wiring.md`.
