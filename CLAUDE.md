# CLAUDE.md — eastwind / altea

This repository is an **in-progress port**. Three migrations run in parallel:

| From (C# / TypeScript, in `old/`) | To (TypeScript, this repo) | What it is |
| --- | --- | --- |
| **C#** | **TypeScript** | language |
| **Signum Framework** — `old/Framework/` (C# engine) + `old/Framework/Signum/React/` (React/TS client) | **altea** — `altea/altea/` | the framework (ORM, LINQ provider, dynamic queries, reflection, React UI kit) |
| **Southwind** (Signum's demo app) — `old/Southwind/` (React), `old/Southwind.Server/` (API), `old/Southwind.Terminal/`, `old/Southwind.Test.*/` | **eastwind** — `eastwind/` | the demo application built on the framework |

`old/` is the **source of truth we port from** — keep it read-only. When in doubt about intended behaviour, open the corresponding Signum/Southwind file and mirror it.

## Repo layout

```
altea/
  altea/              # the framework package (@altea/altea)
    entities/         # shared DATA MODEL (isomorphic client+server): reflection, entity, lite,
                      #   propertyRoute, dynamicQuery tokens, decorators, globals, localization
    client/           # React UI kit (Navigator, Finder, SearchControl, Lines, Operations, Frames, …)
    server/           # engine: connection/, linq/, schema/, sync/, dynamicQuery/  (+ logic/, server-only)
  altea-auth/         # auth module
  altea-test/         # the framework test suite (music model; runs against a real DB)
  altea-office-template/ # docx/pptx/xlsx templating (Signum.Word); hand-built OOXML substrate
  quote-transformer/  # ts-patch transformer for @quoted lambda navigations (see below)
eastwind/
  entities/           # the app's entity domains (orders, customers, products, employees, shippers, …)
  client/             # the app SPA (MainPublic/MainAdmin bootstrap, Layout, Home, per-domain *Client)
  server/             # the app web host (webServer.ts) + starter
  terminal/           # CLI host
  translations/       # per-module translation files
old/                  # Signum + Southwind sources — PORT FROM HERE, do not modify
```

## Philosophy: **copy-and-fix**, but with divergences

Port faithfully: **mirror Signum's class / method names and member order**, copy the source file and fix it for TypeScript + altea's conventions. This keeps the two comparable so future Signum changes are easy to re-apply. **Record every intentional divergence** (in code comments and, for cross-cutting ones, here).

Known structural divergences from Signum (this is what "fix" means — don't port these 1:1):

- **MLists are gone.** No `MList<T>` / `MListElement` wrapper. A collection is a **plain array** of `@part` row entities (or scalars on a row's `@valueField`). `@id` / `@order` / `@backReference` are markers, **not columns**.
- **Do NOT initialize entity fields to a type's default.** `strictPropertyInitialization` is **off** (`altea/tsconfig.base.json`), so a field needs no initializer to compile — and adding one just to silence an imagined warning is noise. Write `@rowOrder order: int;`, `token: QueryTokenEmbedded | null;`, `orderType: OrderTypeEnum;`, `parts: DashboardEntity_Part[];` — **not** `= toInt(0)` / `= null` / `= OrderTypeEnum.Ascending` / `= []`. Specifically:
  - a reflected `T[]` collection is seeded with `[]` by the quote-transformer, so `= []` is always redundant;
  - `@rowOrder` / `@backReference` are filled by the save cascade (and exempt from the implicit NotNull);
  - `= null` on a nullable field says nothing `undefined` doesn't.
  **Keep only the initializers Signum itself declares** — a real non-default business value (`port = 25`, `editableMessage = true`, `chunkSizeSendingEmails = 100`, `creationDate = Clock.now`). Mirroring Signum is the rule; restating a zero value is not.
- **QueryDescription is gone.** Signum shipped a serialized query-metadata DTO (`QueryDescription` / `ColumnDescription` / `QueryTokenWithoutParent`) to the client; altea resolves query tokens from the **registered entity metadata** instead (`entities/dynamicQuery/tokens/*`), so token trees are built client-side (`Finder.getQueryRoot`). There is no DTO, no `fetchQueryDescription`, and no `/api/query/description` route — the only remaining references are comments documenting the divergence.
- **`TypeReference` is the ONE shared value-type descriptor.** `FieldInfo extends TypeReference`; `QueryToken.type` / `PropertyRoute.type` return it. Signum's `RuntimeType` is **server-only** (lives in `server/logic`). Read type facets off it: `.typeName`, `.array`, `.lite`, `.kind`, `.getEnum()`, `.typeInfos()`.
- **No compat accessors.** Use the real model: `entity.constructor` (not `.Type`), `lite.entityType` (a ctor, not a string), `entity.isDirty()` (snapshot-based, not `.modified`).
- **`Type<T>` is always a constructor** (Signum's `GenericType` is gone; `EnumEntity.typeFor` → a bound ctor).
- **UI Lines read their type from `ctx.memberType`**, not an explicit `type={…}` prop. `AutoLine` dispatches to the right editor (text/number/date/enum/entity picker) from it — so many of Signum's parallel rules collapse into one.
- **Dates: luxon → `Temporal`** (`PlainDate` / `PlainDateTime` / `PlainTime` / `Duration`).
- **Enums**: a numeric `XEnum` object + a string-union `type X = keyof typeof XEnum`; the **runtime/wire value is the STRING member name**, so compare with bare literals (`"Shipped"`), not `X.Shipped`.
- **`@field` typeNames are capitalized**: `String` / `Number` / `Decimal` / `Boolean` / `PlainDate` / `Guid` / `Duration`, etc.
- **Reflection metadata is ONE global blob** (translations + auth + queries + operations) shipped eagerly at boot.
- **`@quoted` lambda navigations**: `entity.customer.name`-style navs inside queries are rewritten by `quote-transformer` (a ts-patch transformer). A nav off a **nullable** reference must use `singleOrNull` / `firstOrNull` (OUTER APPLY), not `single` / `first`.
- **Rule sets live in `client/FinderRules.tsx`** (like Signum), not inline in `Finder.tsx` — the editors import Lines, and Lines import Finder, so keeping them separate avoids a module-eval import cycle. Finder imports `FinderRules` for its four `init*Rules()` and installs them, so `import { Finder }` is enough.

> `old/CLAUDE.md` and `old/**/AGENTS.md` describe **Signum's** conventions, not altea's — read them to understand the source, but altea's conventions above win.

## How to build

Types are compiled with **`tspc`** (ts-patch, for the quote-transformer), project-references style:

```bash
pnpm --filter eastwind run build:types    # tspc -b  (builds altea + eastwind)
```

If you move/rename a test or source `.ts`, delete stale `dist/` output first — the recursive `dist/**/*.js` glob will otherwise run both the old and new file.

## How to test (the framework suite)

`altea/altea-test` runs the ported framework against a **real database** using the Node built-in test runner. It reads its connection string from **`ALTEA_TEST_DB`** (a value starting with `postgres` selects PostgreSQL; anything else is treated as SQL Server). Put it in `altea/altea-test/.env.postgres` (or `.env.sqlserver`) — copy `altea/altea-test/.env.example`.

```bash
pnpm --filter @altea/altea-test test:postgres     # or test:sqlserver
```

- First run: seed the DB with `pnpm --filter @altea/altea-test gen:postgres`.
- Runs `tspc -b` then `node --test --test-isolation=none "dist/test/**/*.test.js"`.
- Without `ALTEA_TEST_DB` set, DB-backed suites are skipped (they still compile).

## How to start the web application (eastwind)

The app needs its own connection string in **`eastwind/.env.postgres`** (or `.env.sqlserver`) as **`EASTWIND_DB=postgresql://USER:PASSWORD@HOST:5432/DBNAME`**. Copy `eastwind/.env.example`. **Never commit a real connection string.**

```bash
pnpm --filter eastwind stack:postgres     # or stack:sqlserver
```

This runs `build:types`, then (via `concurrently -k`) three processes together:

- **`types`** — `tspc -b --watch` (recompiles altea + eastwind on change)
- **`api`**  — the web host → **http://localhost:3001** (3000 is left free for a local Signum/Southwind host; override with `PORT`, and `VITE_API_TARGET` for the proxy)
- **`client`** — vite dev server → **http://localhost:5173** (falls back to 5174+ if 5173 is busy)

Open the client URL; it proxies `/api` to the server. `-k` means if one process dies the whole stack stops.

Other useful scripts: `pnpm --filter eastwind dev` (same three watchers, non-`-k`), and the API alone via `pnpm --filter eastwind server:postgres`.

### Password-less dev login (`VITE_PASSWORD_IS_USERNAME`)

The dev seed hashes each user's name as their password (`EastwindMigrations.ensureUser`), so on a local test database the password field is pure friction. Put this in **`eastwind/.env.local`** (vite's own env file — not `.env.postgres`, which only the server reads):

```
VITE_PASSWORD_IS_USERNAME=true
```

Write that file as **UTF-8** — PowerShell's `>` / `>>` produce UTF-16, which dotenv parses as noise and skips *silently* (no warning; the flag just reads `undefined`). Vite reads env files once at startup, so restart the client after editing.

`MainPublic.client.tsx` then sets `AuthClient.Options.passwordIsUsername`, and the login form drops its password input and sends the user name as the password — so `System`, `Steven`, `Anne`, … are each one field away, and switching roles is just another login.

It is a **client-side convenience only**: the request is the normal `/api/auth/login`, so the server has no bypass and every auth rule applies as usual. The flag is read behind `import.meta.env.DEV`, which Vite replaces statically — dead code in a production build.
