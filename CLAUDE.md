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
    test/             # the framework test suite (music model; runs against a real DB) — see "How to test"
  altea-auth/         # auth module (incl. the shared BaseAD half: directory config, ADAuthorizer, OIDC)
  altea-auth-reset-password/ # self-service password reset by e-mail (Signum.Authorization.ResetPassword)
  altea-auth-openid/  # OpenID Connect login (Signum.Authorization.OpenID)
  altea-auth-azuread/ # Entra ID login + Graph directory queries + photos (Signum.Authorization.AzureAD)
  altea-auth-windowsad/ # Windows AD login over LDAP (Signum.Authorization.WindowsAD)
  altea-cache/        # in-memory entity cache + cross-process invalidation (Signum.Caching)
  altea-files-azure/  # Azure Blob Storage file store (Signum.Files.AzureBlobs)
  altea-files-s3/     # S3 / MinIO file store (Signum.Files.S3)
  altea-mailing-exchange/ # sending through Exchange Web Services (Signum.Mailing.ExchangeWS)
  altea-mailing-microsoft-graph/ # sending through Graph + browsing a remote Outlook mailbox
                      #   (Signum.Mailing.MicrosoftGraph, incl. its RemoteEmails half)
  altea-mailing-pop3/ # receiving over POP3 (Signum.Mailing.Pop3)
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

## Naming & formatting conventions

**Two layer organisations, both accepted.** The tsconfig presets (`altea/altea/presets/{data,client,server}.json`)
glob each layer **both** ways: a `data/` / `client/` / `server/` **directory**, or co-located `*.data.ts` /
`*.client.ts[x]` / `*.server.ts` **suffix** files (plus any `*.tsx` — a `.tsx` is always client). Use the
**suffixes** for simple modules, where co-locating a domain (`eastwind/orders/`) matters more than separating it;
use **directories** once a module carries substantial UI or server code, as every framework package does
(`altea-auth/{data,client,server}/`). Either way the layer boundary holds: client never references server, and
data references neither.

**Registration file names.** An app domain folder names its two registration modules after their role:

```
eastwind/orders/
  Order.data.ts          # the entity domain (entities, enums, operation symbols, messages)
  OrderLogic.server.ts   # <Domain>Logic.server.ts — the sb.include(...) / query / operation registration
  OrderClient.client.tsx # <Domain>Client.client.ts[x] — the cb.configure(...) client registration
  Order.tsx              # the entity's view component
  OrderFilter.tsx        # extra components
```

Do **not** shorten `OrderClient.client.tsx` back to `Order.client.tsx`: the base name alone should say what the
module is, since that is all a tab strip, a stack trace or a fuzzy-finder hit shows. The prefix stays
**singular**, matching `<Domain>.data.ts`, even where the exported namespace is plural (`OrdersLogic` /
`OrdersClient` mirror Southwind's `OrdersLogic.cs` and are left as-is). Framework packages already use the same
shape (`ProcessClient.tsx`, `SchedulerClient.tsx`, …).

**One column per line in `defaultColumns`.** A `withQuerySettings` block always writes its columns one per line,
with a trailing comma — never packed onto one line and never wrapped mid-array. Diffs then show exactly which
column moved, and reordering is a line move:

```ts
cb.configure(ShipperEntity)
    .withQuerySettings(token => ({
        defaultColumns: [
            token(a => a.id),
            token(a => a.companyName),
            token(a => a.phone),
        ],
    }));
```

This holds even for a two-column list — do **not** collapse it back to
`.withQuerySettings(token => ({ defaultColumns: [token(s => s.id), token(s => s.key)] }));`.

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
- **Culture: a `CultureInfoEntity` table like Signum's, but the user's pick is a request HEADER, not a cookie.** `CultureInfoEntity` (`data/cultureInfoEntity` + `server/cultureInfoLogic`) is the application's supported-culture table, and it is what an email / Office template's `culture` REFERENCES (`Lite<CultureInfoEntity>`, as in Signum) rather than a free-text tag. `nativeName`/`englishName` come from `Intl.DisplayNames` where Signum uses .NET `CultureInfo`; a lookup falls back from a specific culture to its language ("en-US" → "en"). Where altea diverges:
  - the user's CHOICE lives in the BROWSER (`CultureClient`, localStorage) — Signum stores it server-side per user — and rides on every call as a bare `Accept-Language` tag, which `webApi` turns into a per-request `CultureInfo.withCultures` scope (Signum's ASP.NET request localization). Without that scope every SERVER-resolved label — a registered expression's niceName, validation and exception messages — answers in the process default no matter who asked, and a per-culture CACHE keyed on `currentCulture()` serves whichever language warmed it first to everyone.
  - switching culture RELOADS the page. Signum re-fetches its types and soft-resets, because all its labels are client-resolved; altea has server-resolved labels baked into already-fetched responses, which a soft `resetUI()` leaves stale.
  - Translation files all live in ONE directory (`eastwind/translations`), alpha order sets precedence, so the app's file is named to sort after the framework's `Altea.*`. A Signum module renamed in altea (Word* → Office*) needs its ported XML's Type/Member NAMES remapped, or none of it lands.
- **Enums**: a numeric `XEnum` object + a string-union `type X = keyof typeof XEnum`; the **runtime/wire value is the STRING member name**, so compare with bare literals (`"Shipped"`), not `X.Shipped`.
- **`@field` typeNames are capitalized**: `String` / `Number` / `Decimal` / `Boolean` / `PlainDate` / `Guid` / `Duration`, etc.
- **Reflection metadata is ONE global blob** (nice names + auth + queries + operations) shipped eagerly at boot.
- **`XxxInfo` vs `XxxMetadata` — the two halves of reflection.** `TypeInfo` / `FieldInfo` (`data/reflection`) are the **compile-time** descriptor the quote-transformer stamps onto each constructor: types, units, formats, validators, implementations — identical for every user and every culture. `TypeMetadata` / `FieldMetadata` / `OperationMetadata` (`data/metadata`) are the **runtime** half: per-CULTURE (nice names, plural, gender) and per-ROLE (`min/maxTypeAllowed`, `propertyAllowed`), assembled per request by `ReflectionServer.buildMetadata` and shipped as ONE `MetadataBlob`. Structurally this follows Signum — one entry per type carrying everything about it — but Signum's single `TypeInfo` family is split, so nothing per-role ever lands on the compile-time descriptor. Consequences: `TypeInfo` has NO `operations` / `hasConstructorOperation` / `gender`; read them via `Metadata.tryType(name)` or the client's `getOperationInfos` / `ti.getGender()`.
  - **`TypeMetadata.fields` is keyed by `PropertyRoute.propertyString()`**, so an EMBEDDED type's members appear dotted under every owning entity (`"shipAddress.city"`) — the same key `RulePropertyEntity.path` uses, which makes property authorization a direct lookup. An embedded/model type also gets its own entry; that one is where its translations live. NOTE the UI re-roots its PropertyRoute at each embedded it renders (`RenderEntity`, as Signum does), so a client-side rule lookup must climb the TypeContext chain to the owning entity (`AuthAdminClient.ownerRootedRoute`).
  - **An extension widens the model with `declare module`**, never a side-channel map — altea-auth adds the allowance fields in `altea-auth/data/Rules.ts` (the DATA layer, because a `declare module` only applies to programs that compile the declaring file, and the client tsconfig does not compile `server/`).
- **The display-name API is fluent and typed, never a free function over a ctor.** `OrderEntity.niceName()` / `.nicePluralName()` / `.gender()` / `.newNiceName()`, `OrderEntity.nicePropertyName(a => a.orderNumber)` (and `AddressEmbedded.nicePropertyName(a => a.city)`), `Enum.niceName(ColorEnum, "Red")`, `someSymbol.niceToString()`, `fieldInfo.niceToString()`. The resolver engine behind them lives in `Localization.Internal` (`data/utils/localization`) and has exactly four legitimate callers — `data/entity`, `data/enum`, `data/symbol`, `data/reflection` — plus framework internals that only hold a bare name (the LINQ provider lowering `Type.niceName()` into SQL). A `Localization.Internal.` in application or extension code is a bug. Two gotchas on `nicePropertyName`: the lambda overload needs an INLINE lambda (the transformer emits `__quoted` only at a `Quoted<…>` parameter, and there is no toString fallback), and the transformer does NOT rewrite lambdas in JSX ATTRIBUTES — inside JSX pass the route as a string.
- **An operation knows its owning type — from context, not from its key.** Every operation carries an `entityType` (Signum's `OverridenType`), because a generic parameter is erased at runtime and the alternative is guessing the owner by splitting the symbol key (`"OrderOperation.Ship"` → `OrderEntity`) — which silently lost every operation whose container is not named after its type. But it is almost never WRITTEN: register operations inside `graph(SomeEntity, …)` (Execute / Delete / Construct take the graph's type) or via `withSave` / `withDelete` (which take the include's). Write it only where the owner genuinely differs from that context:
  - **`ConstructFrom` / `ConstructFromMany`**, whose owner is the **SOURCE** type F — that is where the button appears, and F is erased too, so the enclosing graph cannot know it. This is real information, not boilerplate: the old key heuristic got it wrong for 4 of the 5 cross-type constructors in the repo.
  - an operation shared by an ABSTRACT base's implementations. Subclasses inherit it (`OperationLogic.operationsForType` walks the prototype chain), so ONE registration owned by the base covers them all — `withSave` cannot express that, since it owns the operation with the type the include was opened for (see eastwind's `CustomerOperation.Save`).
  - an owner that is a TS INTERFACE and so has no constructor: each implementor adds itself via `OperationLogic.registerForType` (order-independent by design — the implementor may be wired before the operation is registered).
- **`@quoted` lambda navigations**: `entity.customer.name`-style navs inside queries are rewritten by `quote-transformer` (a ts-patch transformer). A nav off a **nullable** reference must use `singleOrNull` / `firstOrNull` (OUTER APPLY), not `single` / `first`.
- **Rule sets live in `client/FinderRules.tsx`** (like Signum), not inline in `Finder.tsx` — the editors import Lines, and Lines import Finder, so keeping them separate avoids a module-eval import cycle. Finder imports `FinderRules` for its four `init*Rules()` and installs them, so `import { Finder }` is enough.

- **Directory login: ONE authorizer, ONE shared base, and no server-rendered config blob.** Signum copies
  ~120 lines of "match / create / update the local user + resolve the role" into each of
  `AzureADAuthorizer`, `OpenIDAuthorizer` and `WindowsADAuthorizer`; altea factors them into
  `altea-auth/server/ADAuthorizer` (`ADAuthorizer<TConfig>`), leaving each module only the claim NAMES it
  reads and ONE overridable hook, `getDirectoryGroups` — the only thing that genuinely differs. The shared
  BaseAD half (the configuration embedded, `IAutoCreateUserContext`, `ExternalUser`, `IDirectoryInviter`,
  the find/create-AD-user routes, the invite-a-user UI, `ProfilePhoto.urlProviders`) likewise lives in
  altea-auth, exactly as it does in `Signum.Authorization`. Also:
  - `AuthLogic.authorizer` is a single slot, so at most ONE directory owns the login flow; the app picks
    (eastwind: `EASTWIND_AD_PROVIDER`).
  - Signum injects the browser-visible configuration into `Index.cshtml`
    (`window.__azureADConfig` / `__openIDConfig`). altea has no server-rendered page, so each module serves
    it from an ANONYMOUS endpoint the client fetches once at boot — which makes
    `registerAzureADAuthenticator` / `registerOpenIDAuthenticator` async, and makes them SELF-GATING
    (a module that is not configured answers null and stands down).
  - `Microsoft.Graph` + `Azure.Identity` become plain REST + the client-credentials token POST
    (`altea-auth-azuread/server/MicrosoftGraph`); `ConfigurationManager` + `JwtSecurityTokenHandler` become
    `altea-auth/server/OpenIdConnect` (discovery cache + `jose` over a locally fetched JWKS, so OpenID's
    `avoidSSLVerify` applies to the JWKS request too).
  - `System.DirectoryServices` becomes LDAP (`ldapts`, in `altea-auth-windowsad/server/WindowsDirectory`):
    `ValidateCredentials` → a simple bind, `UserPrincipal.GetGroups` → `LDAP_MATCHING_RULE_IN_CHAIN` (a
    plain `memberOf` read would silently miss nested groups), `Enabled` → `userAccountControl` bit 2. The
    `objectSid` byte layout is formatted to the exact `S-1-5-…` string `externalId` stores.
  - Windows INTEGRATED authentication (SPNEGO/Kerberos) does NOT port: Node has no SSPI. It is an injected
    seam (`WindowsADServer.negotiateProvider`, null by default → a clear error); everything else in that
    module works without it.
  - The two Microsoft Graph search pages are `ManualDynamicQueryCore`s named by their ROW MODEL
    (`ActiveDirectoryUserModel` / `…GroupModel`), not by an enum member, and their column captions are the
    fields' own `@niceName` — altea has no QueryDescription to hang `ColumnDisplayName` on. They also
    re-apply the request's filters/orders IN MEMORY, because Graph silently loosens what it cannot express.

- **A REMOTE file store cannot rename, and cannot be read synchronously.** `altea-files` splits a save into
  a SYNC `prepareSuffix` (assign the suffix, so the owning row can be INSERTed with it) and an ASYNC
  `writePrepared` (write the bytes just before commit). `altea-files-azure` / `altea-files-s3` therefore
  **REFUSE a `renameAlgorithm`** — the collision probe is a network round-trip, and a rename decided in the
  async half could not be written back to the row that already carries the old suffix. Signum defaults it to
  null in both backends and says why ("ExistBlob is too slow, consider using CalculateSuffix with a GUID!"),
  which is what the default suffix generator does. Likewise `readAllBytesSync` THROWS in both, so a
  `BigString` column must not live in a remote store. Signum's chunked-upload API (StartUpload /
  UploadChunk / …) is not ported at all, because altea-files has no chunk protocol: a file reaches the server
  inside the entity graph. S3's PRESIGNED url is `presignedUrl()` rather than `fullWebPath()`, because SigV4
  presigning is async in the AWS v3 SDK (Azure's SAS signing is sync, so it stays in `fullWebPath`).

- **The mail SERVICES are a registry, and each protocol package fills one slot.** `EmailServiceEntity`
  (sending) and `EmailReceptionServiceEntity` (receiving) are abstract with an EMPTY / minimal
  `@implementedBy`; the APP widens it in its shared entity-overrides module (both tiers), and each package's
  `Logic.start` re-CHECKS that and fails loudly rather than silently never being reachable — Signum's
  `AssertImplementedBy`. Two things about credentials: Signum hides a stored password and encrypts the
  typed-in one through a per-type JSON PROPERTY CONVERTER, while altea does it in the SAVE OPERATION through
  `registerEmailServiceSave` / `registerEmailReceptionServiceSave`, so a package in another workspace package
  supplies the one line that knows which of ITS fields holds the password; and the Microsoft Graph sender's
  client secret is stored ENCRYPTED here where Signum keeps it in the clear (it is a tenant-wide credential
  that would otherwise round-trip to the browser on every read). Protocol substrates: EWS becomes hand-built
  SOAP (`altea-mailing-exchange/server/ExchangeWebServices`) because the EWS Managed API has no JS
  counterpart, `Microsoft.Graph` becomes the REST helper altea-auth-azuread already owns, MailKit's POP3
  becomes ~200 lines over `node:tls` and MailKit's MIME becomes **mailparser**. Three things do NOT port:
  Windows INTEGRATED authentication for EWS (no SSPI on Node — an injected `negotiateProvider` seam, as in
  altea-auth-windowsad), Autodiscover's SCP / DNS-SRV paths (only the two well-known POX URLs), and TNEF
  (`winmail.dat`) unpacking on reception.

- **The remote-mailbox search page is addressed by USER, not by mailbox id.** Signum's RemoteEmails routes
  take the directory object id (`{oid}`) and the client reads it off `UserLiteModel.ExternalId`; altea has no
  lite model, so the routes take the USER's primary key and resolve the mailbox server-side — which also
  means a caller cannot read an arbitrary mailbox by naming its oid. Its attachment download stays
  AUTHENTICATED (Signum has to make it anonymous, because it renders inline images as a bare `<img src>`);
  the client fetches the bytes through the app's own ajax and rewrites `cid:` images to blob URLs, the shape
  altea-files' FileImage already uses. And Signum's one `RemoteEmailMessageModel` becomes TWO types — a
  `RemoteEmailMessageRowModel` for the query (a query row model cannot have a member called `id`) and the
  message model for the view.

- **Caching (`altea-cache`) holds rows, not entities, and never SqlDependency.** `sb.include(X).withCache()`
  keeps X's table in memory as raw column tuples plus a completer that fills a FRESH instance per read, so
  what a caller gets can be mutated and saved. Divergences from Signum.Caching: there is no
  `CachedTableMList` (altea's collections are `@part` child rows, i.e. always Signum's VirtualMList shape —
  served from the child type's own cached table through a back-reference index), and a cached type's own
  lite is "materialise the row, then `toLite()`" (altea has no lite-model entity). A **SEMI-cached lite** —
  a `Lite<Transactional>` on a cached row, e.g. cached `Country` → `Lite<Person>` — is a TRIMMED side table:
  only the columns the display expression reads, found by walking the custom lite's / `@quoted toString()`'s
  expression tree (`LiteColumnsFinder`, altea's ToStringColumnsFinderVisitor + LiteModelExpressionVisitor),
  for only the rows a cached table references (an INNER JOIN back to the owner). **Caching the whole row
  there would be a trap**: it transitively drags in whatever that row references until most of the database
  is in memory — so the registration walk STOPS at a semi type (Signum recurses; altea needs not to, because
  a full-entity reference on a cached row is left a Retriever stub and completed from the database).
  **SqlDependency is not portable** — Node's SQL Server driver has no query notifications — so cross-process
  invalidation is a broadcast: `PostgresBroadcast` (LISTEN/NOTIFY) or `SimpleHttpBroadcast` (what a SQL
  Server app uses). Two things are REFUSED at startup rather than silently mis-served: a
  cached type with row-level TypeConditions (altea enforces those as a query filter, which a cached read
  bypasses) and one with `additionalBindings`. And `sb.globalLazy(…, { invalidateWith: [X] })` does NOT
  start caching X (Signum force-caches it); the lazy keeps its event wiring and is also reset by a broadcast.

> `old/CLAUDE.md` and `old/**/AGENTS.md` describe **Signum's** conventions, not altea's — read them to understand the source, but altea's conventions above win.

## How to build

Types are compiled with **`tspc`** (ts-patch, for the quote-transformer), project-references style:

```bash
pnpm --filter eastwind run build:types    # tspc -b  (builds altea + eastwind)
```

If you move/rename a test or source `.ts`, delete stale `dist/` output first — the recursive `dist/**/*.js` glob will otherwise run both the old and new file.

## How to test

**A package's tests live INSIDE it, in `test/`** — its own fourth layer (`tsconfig.test.json`), built by the
same `tspc -b` into `dist/test/**`, so a module's suites move with the module. `test/**` is excluded from the
three shipping presets, so a fixture named `*.data.ts` or a `.tsx` test can never leak into what the package
publishes; conversely the test project is the one place that gets BOTH node types and the DOM lib, since it
drives server and client code alike. (The suites used to be sibling packages — `@altea/altea-test`,
`@altea/altea-auth-test`; each is now `test/` inside the package it tests.)

Each suite runs against a **real database** with the Node built-in test runner, reading its own connection
string so the suites never share a schema — a value starting with `postgres` selects PostgreSQL, anything
else is treated as SQL Server. Put it in the PACKAGE's `.env.postgres` (or `.env.sqlserver`); copy its
`.env.example`. Without the variable the DB-backed cases are SKIPPED (everything still compiles, and the
DB-free suites still run).

| Suite | Env var | Command |
| --- | --- | --- |
| framework (music model) | `ALTEA_TEST_DB` | `pnpm --filter @altea/altea test:postgres` |
| authorization (sample domain) | `ALTEA_AUTH_TEST_DB` | `pnpm --filter @altea/altea-auth test:postgres` |
| cache (shop domain) | `ALTEA_CACHE_TEST_DB` | `pnpm --filter @altea/altea-cache test:postgres` |

- First run: seed that suite's DB with the matching `gen:postgres` (it CLEANS and regenerates it).
- Each runs `tspc -b` then `node --test --test-isolation=none "dist/test/**/*.test.js"`.

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
