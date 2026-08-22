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
    translations/     # the framework's own `Altea.<culture>.xml` — EVERY package ships its own
  altea-auth/         # auth module (incl. the shared BaseAD half: directory config, ADAuthorizer, OIDC)
  altea-auth-reset-password/ # self-service password reset by e-mail (Signum.Authorization.ResetPassword)
  altea-auth-openid/  # OpenID Connect login (Signum.Authorization.OpenID)
  altea-auth-azuread/ # Entra ID login + Graph directory queries + photos (Signum.Authorization.AzureAD)
  altea-auth-windowsad/ # Windows AD login over LDAP (Signum.Authorization.WindowsAD)
  altea-agent/        # LLM chatbot + skills-as-tools + provider clients + an MCP endpoint (Signum.Agent)
  altea-alert/        # user notifications: the Alert entity, the navbar bell + its WebSocket push, and the
                      #   "mail me my pending alerts" scheduled task (Signum.Alerts)
  altea-cache/        # in-memory entity cache + cross-process invalidation (Signum.Caching)
  altea-codemirror/   # code editors, CLIENT-ONLY (Signum.CodeMirror); CodeMirror 6, not 5
  altea-concurrent-user/ # live presence + stale-entity detection on an open entity (Signum.ConcurrentUser)
  altea-diff-log/     # before/after entity dumps on each operation log + the diff view (Signum.DiffLog)
  altea-dynamic/      # views defined in the DATABASE and interpreted, + CSS overrides and SQL migrations
                      #   from the admin UI (the INTERPRETED half of Signum.Dynamic — see below)
  altea-eval/         # EvalEmbedded<F>: a TypeScript script stored in the DATABASE, type-checked and run
                      #   at runtime (Signum.Eval, whose Roslyn becomes the TypeScript compiler)
  altea-html-editor/  # WYSIWYG rich text over Lexical + viewer + html→text (Signum.HtmlEditor)
  altea-files-azure/  # Azure Blob Storage file store (Signum.Files.AzureBlobs)
  altea-files-s3/     # S3 / MinIO file store (Signum.Files.S3)
  altea-mailing-exchange/ # sending through Exchange Web Services (Signum.Mailing.ExchangeWS)
  altea-mailing-microsoft-graph/ # sending through Graph + browsing a remote Outlook mailbox
                      #   (Signum.Mailing.MicrosoftGraph, incl. its RemoteEmails half)
  altea-mailing-pop3/ # receiving over POP3 (Signum.Mailing.Pop3)
  altea-office-template/ # docx/pptx/xlsx templating (Signum.Word); hand-built OOXML substrate
  altea-time-machine/ # browse / compare / restore the versions of a @systemVersioned row
                      #   (Signum.TimeMachine)
  altea-tour/         # guided in-app tours over driver.js, anchored to a type / dashboard / user query /
                      #   declared trigger (Signum.Tour)
  altea-translations/ # translating the app: the per-package translation XML files (code) and the
                      #   per-instance @translatable fields (data) — Signum.Translation, both halves
  altea-workflow/     # BPMN workflow engine + bpmn-js designer (Signum.Workflow)
  altea-playwright/   # strongly-typed Playwright page objects for an altea UI, for an app's e2e suite
                      #   (Signum.Playwright); the only package that is neither data/client/server
  quote-transformer/  # ts-patch transformer for @quoted lambda navigations (see below)
eastwind/
  entities/           # the app's entity domains (orders, customers, products, employees, shippers, …)
  globals/            # Southwind's Globals/: the ApplicationConfiguration row EVERY module's settings live
                      #   on, its view, and the app's TypeCondition / agent symbols
  client/             # the app SPA (MainPublic/MainAdmin bootstrap, Layout, Home, per-domain *Client)
  server/             # the app web host (webServer.ts) + starter
  terminal/           # CLI host
  test/               # the app's Playwright e2e suites (see "How to test in a browser")
  translations/       # the APP's own `Eastwind.<culture>.xml` (each module ships its own)
old/                  # Signum + Southwind sources — PORT FROM HERE, do not modify
```

## Naming & formatting conventions

**Two layer organisations, both accepted.** The tsconfig presets (`altea/altea/presets/{base,data,client,server}.json`
— `base` is the shared compilerOptions every other one extends, and what a project that is NOT one of the three
layers extends directly: eastwind's terminal, altea-playwright)
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
- **Do NOT initialize entity fields to a type's default.** `strictPropertyInitialization` is **off** (`altea/altea/presets/base.json`), so a field needs no initializer to compile — and adding one just to silence an imagined warning is noise. Write `@rowOrder order: int;`, `token: QueryTokenEmbedded | null;`, `orderType: OrderTypeEnum;`, `parts: DashboardEntity_Part[];` — **not** `= toInt(0)` / `= null` / `= OrderTypeEnum.Ascending` / `= []`. Specifically:
  - a reflected `T[]` collection is seeded with `[]` by the quote-transformer, so `= []` is always redundant;
  - `@rowOrder` / `@backReference` are filled by the save cascade (and exempt from the implicit NotNull);
  - `= null` on a nullable field says nothing `undefined` doesn't.
  **Keep only the initializers Signum itself declares** — a real non-default business value (`port = 25`, `editableMessage = true`, `chunkSizeSendingEmails = 100`, `creationDate = Clock.now`). Mirroring Signum is the rule; restating a zero value is not.
- **QueryDescription is gone.** Signum shipped a serialized query-metadata DTO (`QueryDescription` / `ColumnDescription` / `QueryTokenWithoutParent`) to the client; altea resolves query tokens from the **registered entity metadata** instead (`entities/dynamicQuery/tokens/*`), so token trees are built client-side (`Finder.getQueryRoot`). There is no DTO, no `fetchQueryDescription`, and no `/api/query/description` route — the only remaining references are comments documenting the divergence.
- **`TypeReference` is the ONE shared value-type descriptor.** `FieldInfo extends TypeReference`; `QueryToken.type` / `PropertyRoute.type` return it. Signum's `RuntimeType` is **server-only** (lives in `server/logic`). Read type facets off it: `.typeName`, `.array`, `.lite`, `.kind`, `.getEnum()`, `.typeInfos()`.
- **No compat accessors.** Use the real model: `entity.constructor` (not `.Type`), `lite.entityType` (a ctor, not a string), `entity.isDirty()` (snapshot-based, not `.modified`).
- **`Type<T>` is the ONE entity-type handle, and it is a constructor** (Signum's `GenericType` is gone; `EnumEntity.typeFor` → a bound ctor). It is `abstract new (...args: any[]) => T`, so an ABSTRACT base (`CustomerEntity`, `AwardEntity`) is a valid handle — an operation or a rule may be attached to one and inherited by its implementations. There used to be a second, abstract-tolerant `EntityType<T>` beside it; two handles for one concept meant every signature had to pick a side, so they are merged. The few places that INSTANTIATE narrow explicitly — `newInstance(type)` (the Retriever building a row, the serializer, the enum-table synchronizer) — and `Entity.create`'s `this` stays `new () => T`, because a factory cannot be abstract-tolerant.
- **UI Lines read their type from `ctx.memberType`**, not an explicit `type={…}` prop. `AutoLine` dispatches to the right editor (text/number/date/enum/entity picker) from it — so many of Signum's parallel rules collapse into one.
- **Dates: luxon → `Temporal`** (`PlainDate` / `PlainDateTime` / `PlainTime` / `Duration`).
- **Culture: a `CultureInfoEntity` table like Signum's, but the user's pick is a request HEADER, not a cookie.** `CultureInfoEntity` (`data/cultureInfoEntity` + `server/cultureInfoLogic`) is the application's supported-culture table, and it is what an email / Office template's `culture` REFERENCES (`Lite<CultureInfoEntity>`, as in Signum) rather than a free-text tag. `nativeName`/`englishName` come from `Intl.DisplayNames` where Signum uses .NET `CultureInfo`; a lookup falls back from a specific culture to its language ("en-US" → "en"). Where altea diverges:
  - the user's CHOICE lives in the BROWSER (`CultureClient`, localStorage) — Signum stores it server-side per user — and rides on every call as a bare `Accept-Language` tag, which `webApi` turns into a per-request `CultureInfo.withCultures` scope (Signum's ASP.NET request localization). Without that scope every SERVER-resolved label — a registered expression's niceName, validation and exception messages — answers in the process default no matter who asked, and a per-culture CACHE keyed on `currentCulture()` serves whichever language warmed it first to everyone.
  - switching culture RELOADS the page. Signum re-fetches its types and soft-resets, because all its labels are client-resolved; altea has server-resolved labels baked into already-fetched responses, which a soft `resetUI()` leaves stale.
  - Translation files live in EACH PACKAGE's own `translations/` directory (`altea/altea-workflow/translations/Altea.Workflow.es.xml`), not in one per-app folder as in Signum — a module's translations travel with the module, so any application that installs it gets them for free. At boot `loadAppTranslations` walks the app's dependency graph (through packages that depend on `@altea/altea`), loads each module's directory in package-name order, and loads the app's own `<appRoot>/translations` LAST so an app file wins a key collision. A Signum module renamed in altea (Word* → Office*) needs its ported XML's Type/Member NAMES remapped, or none of it lands.
- **Enums**: a numeric `XEnum` object + a string-union `type X = keyof typeof XEnum`; the **runtime/wire value is the STRING member name**, so compare with bare literals (`"Shipped"`), not `X.Shipped`.
- **`@field` typeNames are capitalized**: `String` / `Number` / `Decimal` / `Boolean` / `PlainDate` / `Guid` / `Duration`, etc.
- **Reflection metadata is ONE global blob** (nice names + auth + queries + operations) shipped eagerly at boot.
- **`XxxInfo` vs `XxxMetadata` — the two halves of reflection.** `TypeInfo` / `FieldInfo` (`data/reflection`) are the **compile-time** descriptor the quote-transformer stamps onto each constructor: types, units, formats, validators, implementations — identical for every user and every culture. `TypeMetadata` / `FieldMetadata` / `OperationMetadata` (`data/metadata`) are the **runtime** half: per-CULTURE (nice names, plural, gender) and per-ROLE (`min/maxTypeAllowed`, `propertyAllowed`), assembled per request by `ReflectionServer.buildMetadata` and shipped as ONE `MetadataBlob`. Structurally this follows Signum — one entry per type carrying everything about it — but Signum's single `TypeInfo` family is split, so nothing per-role ever lands on the compile-time descriptor. Consequences: `TypeInfo` has NO `operations` / `hasConstructorOperation` / `gender`; read them via `Metadata.tryType(name)` or the client's `getOperationInfos` / `ti.getGender()`.
  - **`TypeMetadata.fields` is keyed by `PropertyRoute.propertyString()`**, so an EMBEDDED type's members appear dotted under every owning entity (`"shipAddress.city"`) — the same key `RulePropertyEntity.path` uses, which makes property authorization a direct lookup. An embedded/model type also gets its own entry; that one is where its translations live. NOTE the UI re-roots its PropertyRoute at each embedded it renders (`RenderEntity`, as Signum does), so a client-side rule lookup must climb the TypeContext chain to the owning entity (`AuthAdminClient.ownerRootedRoute`).
  - **An extension widens the model with `declare module`**, never a side-channel map — altea-auth adds the allowance fields in `altea-auth/data/Rules.ts` (the DATA layer, because a `declare module` only applies to programs that compile the declaring file, and the client tsconfig does not compile `server/`).
- **The display-name API is fluent and typed, never a free function over a ctor.** `OrderEntity.niceName()` / `.nicePluralName()` / `.gender()` / `.newNiceName()`, `OrderEntity.nicePropertyName(a => a.orderNumber)` (and `AddressEmbedded.nicePropertyName(a => a.city)`), `Enum.niceName(ColorEnum, "Red")`, `someSymbol.niceToString()`, `fieldInfo.niceToString()`. The resolver engine behind them lives in `Localization.Internal` (`data/utils/localization`) and has exactly four legitimate callers — `data/entity`, `data/enum`, `data/symbol`, `data/reflection` — plus framework internals that only hold a bare name (the LINQ provider lowering `Type.niceName()` into SQL). A `Localization.Internal.` in application or extension code is a bug. Two gotchas on `nicePropertyName`: the lambda overload needs an INLINE lambda (the transformer emits `__quoted` only at a `Quoted<…>` parameter, and there is no toString fallback), and the transformer does NOT rewrite lambdas in JSX ATTRIBUTES — inside JSX pass the route as a string.
- **An operation's owning type is its FIRST CONSTRUCTOR ARGUMENT, not an option.** `new Graph.Execute(OrderEntity, OrderOperation.Ship, { execute })` — the argument stands in for the erased generic (Signum writes `new Graph<OrderEntity>.Execute(sym)` and reads T back through reflection), and the alternative is guessing the owner by splitting the symbol key (`"OrderOperation.Ship"` → `OrderEntity`), which silently lost every operation whose container is not named after its type. As an argument it cannot be forgotten, and it reads in the same position as `graph(OrderEntity, …)` and `sb.include(OrderEntity)`. It is still almost never written by hand, because the surrounding registration passes it: inside `graph(SomeEntity, …)` for Execute / Delete / Construct, and `withSave` / `withDelete` use the include's type. What stays explicit is what those cannot know:
  - **`ConstructFrom` / `ConstructFromMany`**, whose owner is the **SOURCE** type F — that is where the button appears, and F is erased too, so the enclosing graph cannot know it. Both take it FIRST: `g.ConstructFrom(CustomerEntity, OrderOperation.CreateOrderFromCustomer, { … })`. This is real information, not boilerplate: the old key heuristic got it wrong for 4 of the 5 cross-type constructors in the repo.
  - an operation shared by an ABSTRACT base's implementations. Subclasses inherit it (`OperationLogic.operationsForType` walks the prototype chain), so ONE registration owned by the base covers them all — `withSave` cannot express that, since it owns the operation with the type the include was opened for (see eastwind's `CustomerOperation.Save`).
  - an owner that is a TS INTERFACE and so has no constructor: each implementor adds itself via `OperationLogic.registerForType` (order-independent by design — the implementor may be wired before the operation is registered).
- **A graph is a DECLARED const, registered from `start`** — Signum's `new OrderGraph().Register()`, and eastwind's `OrderGraph` / altea-auth's `UserGraph` are the shape: `const XGraph = graph(XEntity, …);` at file scope (or, where its bodies call the logic namespace's own private helpers, at the end of that namespace), and `XGraph.register();` in `start`. Never `graph(…).register()` inline: the declaration is then readable on its own, can be inspected / re-registered from elsewhere, and the registration is one line in `start` beside the includes. It also makes the failure mode visible — two altea-dynamic graphs had been written inline with the result DROPPED, so `DynamicViewOperation.Create/Clone` and `DynamicSqlMigrationOperation.Create/Execute` did not exist at runtime at all.
- **`@quoted` lambda navigations**: `entity.customer.name`-style navs inside queries are rewritten by `quote-transformer` (a ts-patch transformer). A nav off a **nullable** reference must use `singleOrNull` / `firstOrNull` (OUTER APPLY), not `single` / `first`.
- **Rule sets live in `client/FinderRules.tsx`** (like Signum), not inline in `Finder.tsx` — the editors import Lines, and Lines import Finder, so keeping them separate avoids a module-eval import cycle. Finder imports `FinderRules` for its four `init*Rules()` and installs them, so `import { Finder }` is enough.

- **Signum.Alerts → altea-alert: a notification is an entity, and the bell is a WebSocket consumer.** The
  module ports whole (entity + operations, the two endpoints the bell polls, the dropdown, the alert view,
  and the opt-in "mail me my pending alerts" task). Divergences:
  - **AlertTypeSymbol is a plain Symbol, not a SemiSymbol** (altea has none — the same call altea-agent
    makes for AgentSymbol), so an alert type is DECLARED in code via `AlertLogic.registerAlertType`; its
    Save/Delete operations and its editor go with it.
  - **`Title` / `Text` are stored columns, not expressions.** Signum declares them `[AutoExpressionField]`
    and REPLACES them in the logic layer with bodies that call `AlertType.GetText()` — a dictionary lookup
    no SQL can evaluate. altea has neither ReplaceExpression nor a way to lower that, so a query sees
    `titleField` / `textField` and the alert-type fallback happens where the registry is: on the server at
    RETRIEVE (`textFromAlertType`, Signum's same event) and on the client for the title.
  - **`CurrentState` is in-memory** (a ternary returning an enum does not lower); its three boolean faces
    (`alerted` / `attended` / `future`) ARE @quoted, so "what is due now" still filters in SQL — written
    `Temporal.PlainDateTime.compare(a, b) <op> 0`, the form the provider translates.
  - **SignalR → altea's WebSocket hub**, and the group a tab joins is the socket's OWN user (Signum trusts
    the token the client passes to `Login`). Cross-process notification keeps Signum's shape exactly:
    `CacheLogic.registerBroadcastReceiver("AlertForReceiver", …)` with the same "*"/chunked-ids protocol.
  - the notification MAIL lives in its own `AlertNotificationLogic` (it is the only part needing altea-email
    + altea-scheduler), sends without Signum's `EmailPackage` (not ported), and drops Signum's
    `TextFormatted` — the link-placeholder expansion lives in the client's `AlertsClient.format`.
  - it surfaced a CORE gap: `/api/operation/executeMultiple` + `deleteMultiple` did not exist, so every
    contextual multi-operation 404'd; they are now NDJSON routes (one `{entity, error}` per line, each lite
    in its own transaction), and the two client readers parse each line with `Serializer.parse` — a Lite is
    a CLASS in altea, and the caller calls `.key()` on it.

- **Signum.Playwright → altea-playwright: the page objects port, the C# ergonomics do not.** ~5.4k lines of
  C# become ~1.5k of TypeScript, because the JS Playwright binding already auto-waits and composes locators
  — what survives is the part that is about SIGNUM, not about Playwright: addressing a control by its
  PROPERTY ROUTE and waiting on the app's own re-render markers. altea renders all of them
  (`data-property-path`, `data-changes`, `data-main-entity`, `data-refresh-count`, `data-search-count`,
  `data-entity`, `data-column-name`), so the selector contract carries over almost unchanged. Divergences:
  - **`data-property-path` is the line's OWN member** (`city`), not Signum's full dotted route
    (`shipAddress.city`) — altea re-roots the PropertyRoute at each embedded — so a nested line is reached
    by narrowing step by step. The property LAMBDA is resolved by `PropertyRoute.addLambda` off the
    quote-transformer's tree, which is why an e2e suite must be compiled by `tspc` (Playwright's own
    esbuild transform would strip `__quoted` silently — hence `testDir: dist/test`).
  - `data-entity` is `"CleanType;id"` (2 parts), where Signum's is `"typeName;id;isNew"`.
  - altea's filter table ends with a `tr.sf-filter-create` row, so the rows are selected by class — a plain
    `tbody > tr` (Signum's) addresses the wrong row after an add.
  - Signum's ValidationSummary proxy looks for `ul.validation-summary`, which neither framework renders
    (both render `validaton-summary`, missing the "i") — the port uses the class the DOM has.
  - **the CLOSURE SCOPING is preserved**, because it is the heart of the API rather than a C# ergonomic:
    Signum writes `b.SearchPageAsync(...).Then(async persons => { … })`, where `Then` (Signum.Utilities'
    TaskExtensions) disposes the proxy in a `finally` — so the closure IS the open page / modal, and leaving
    it closes the modal and waits for the line that opened it to re-render. `scoped(source, body)` is that
    function one for one, and every scoped proxy also implements `Symbol.asyncDispose`, so `await using`
    reads the same. (The modal openers therefore return a typed PROXY, not a Locator — which introduces a
    module cycle proxy → modal → LineContainer → proxy, broken by importing the modal classes lazily inside
    the methods.)
  - NOT ported: the CDP debug-mode launcher (`@playwright/test` has --headed / --debug / UI mode), and the
    proxies for lines altea does not have (EntityList, HtmlLine, GuidBox, EnumCheckBoxList, MultiValueLine)
    plus the panel-level Toolbar / SearchValueLine / ColumnEditor / ContextMenu ones.

- **A module registers what a module owns; the app registers only what only the app knows.** Signum's
  modules seed their own surface, so Southwind's Starter is short. Where the altea port had pushed that work
  into eastwind, it is now back in the module — the rule to apply when adding one:
  - `EvalLogic` SEEDS the framework's own modules (Signum's pre-filled `AssemblyTypes` / `Namespaces`;
    Southwind calls `EvalLogic.Start(sb)` and registers nothing), and altea-workflow registers its three
    eval-visible modules from its own start. An app registers its ENTITY DOMAINS — which need `typesPath`,
    since nothing depends on the app — plus altea-auth's, because a framework package must not depend on an
    optional one.
  - `AgentLogic.start` registers the ten skills the module SHIPS (Signum's `SkillCode` base constructor
    auto-registers, so its apps never list them); the app supplies only the skill TREE.
  - `EmailLogic.start` registers the USER as an email owner (Signum declares `UserEntity.EmailOwnerData` in
    Signum.Authorization) and `EmailMasterTemplateLogic` ships a neutral default master template.
  - the cloud file stores own their CONNECTION (`AzureBlobStorage` / `S3Storage`: cached client, container /
    bucket naming); the app picks the backend and supplies credentials, which is where Signum keeps them
    (`azureStorageConnectionString` is a `Starter.Start` parameter, never a configuration member).
  - a DOMAIN's scheduled tasks, process algorithms and workflow wiring live in the domain folder
    (`eastwind/orders/`), which is where Southwind keeps them (`Orders/OrdersLogic.cs` registers
    `OrderProcess.CancelOrders` and the two `OrderTask`s, declared in `Orders/OrderEntity.cs`).

- **App settings are ONE persisted row, and every module start takes a lambda to it.** eastwind ports
  Southwind's `ApplicationConfigurationEntity` (`eastwind/globals/`): one row per environment carrying each
  module's configuration embedded (mail, chatbot, workflow, folders, and the three directories), edited at
  `/view/ApplicationConfiguration`, and each `Logic.start` receives `() => GlobalsLogic.configuration().x`
  exactly as Signum's `EmailLogic.Start(sb, () => Configuration.Value.Email, …)` does. The per-module
  `eastwind<Module>.server.ts` files keep only what is genuinely app CODE (skill trees, email owners, ORDER
  as a case main entity, the store factory); nothing there reads `EASTWIND_*` for a setting any more — the
  environment only SEEDS the row, in the `CreateCulturesAndConfiguration` migration. Divergences:
  - **which row is `DB_ENVIRONMENT`**, matched against `environment`, where Signum matches `DatabaseName`
    against `Connector.Current.DatabaseName()` (altea's Connector exposes no such name, and a deployment
    controls an env var anyway). The entity carries a `@quoted isActive()` so the search page can say which
    row is live; the value it compares against is a module CONST in the DATA layer, read off `globalThis`
    (that layer is isomorphic and ships no node types) — the transformer captures a free identifier by
    value, so a `process.env` read inside the quoted body would have no SQL translation.
  - **the lazy is mirrored into a SYNC snapshot.** altea's ResetLazy is async while every module's
    configuration getter is sync, so `GlobalsLogic.warmUp()` fills a snapshot after `schema.initialize()`
    (the pattern `CultureInfoLogic` already uses) and the `saved` event refreshes it — which is what makes
    an edit take effect without a restart, as Signum's `InvalidateWith` does.
  - **what stays in the environment** is what Southwind also keeps in `appsettings.json`: the connection
    string, the file-store BACKEND + its cloud credentials (Signum's `azureStorageConnectionString` is a
    `Starter.Start` parameter), and `EASTWIND_AD_PROVIDER` — which directory owns the login flow, decided
    while the schema is built, before a row can be read.
  - **the AD configurations became `@part` ENTITIES** (`BaseADConfigurationEmbedded extends Entity`), because
    persisting them means persisting `roleMapping`, and a collection is `@part` child rows whose back
    reference needs a real owner TABLE — which a flattened embedded is not. Same reshaping altea-email
    applied to `SmtpNetworkDeliveryEmbedded`; Signum's names are kept, "Embedded" suffix included. The ROW
    type is declared per module (`AzureADConfigurationEmbedded_RoleMapping`, …) rather than shared, since a
    `@part` collection is keyed by ONE back reference — three directories sharing one row type on one owner
    would read each other's rows — hence `BaseADConfigurationEmbedded.roleMappings()`, the accessor the
    shared ADAuthorizer reads.

- **Directory login: ONE authorizer, ONE shared base, and no server-rendered config blob.** Signum copies
  ~120 lines of "match / create / update the local user + resolve the role" into each of
  `AzureADAuthorizer`, `OpenIDAuthorizer` and `WindowsADAuthorizer`; altea factors them into
  `altea-auth/server/ADAuthorizer` (`ADAuthorizer<TConfig>`), leaving each module only the claim NAMES it
  reads and ONE overridable hook, `getDirectoryGroups` — the only thing that genuinely differs. The shared
  BaseAD half (the configuration embedded, `IAutoCreateUserContext`, `ExternalUser`, `IDirectoryInviter`,
  the find/create-AD-user routes, the invite-a-user UI, `ProfilePhoto.urlProviders`) likewise lives in
  altea-auth, exactly as it does in `Signum.Authorization`. Also:
  - `AuthLogic.authorizer` is a single slot, so at most ONE directory owns the login flow; the app picks
    (eastwind: `EASTWIND_AD_PROVIDER`). The CONFIGURATION itself is a persisted @part entity on the app's
    ApplicationConfiguration row — see the bullet above.
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

- **The diff log is TWO core seams plus a mixin.** `altea-diff-log` stores the before/after dumps of an
  operation on the operation log itself, which needs two things core did not have and now does:
  `ObjectDumper` (`data/objectDumper`) and `OperationLogic.surroundOperation` — Signum's
  `SurroundOperation`, an event returning an `IDisposable`, becomes a before-handler that returns an AFTER
  callback (which still runs when the operation threw). The dumper keeps Signum's C#-flavoured output
  verbatim (`new OrderEntity(10248) { … }`, `new LiteImp<CustomerEntity>(5, "Acme")`, 3-space indent), because
  that shape is the contract `simplifyDump`'s regex reads and what makes a dump comparable across the two
  frameworks. Divergences: `[AvoidDump]` / `[AvoidDumpEntity]` become `ObjectDumper.avoidDump` /
  `avoidDumpEntity` Sets keyed `"TypeName.fieldName"`; `Schema.ForceCultureInfo` is unnecessary because the
  dumper formats invariantly by construction (Temporal → ISO, Decimal → `toString`); mixins are not a
  separate branch (altea inlines them). Two things do NOT port: `registerWhenAlreadyFilteringBy` (altea has
  no "only while the query already filters by this property" condition kind, so
  `OperationLogTypeCondition.FilteringByTarget` is declared but unregistered) and the auditor-token registry
  its client half pairs with. And note the MIXIN's two consequences — the fields are FLATTENED onto
  `operation_log` (`initial_state_text`, …), but a client PropertyRoute still needs the mixin STEP
  (`subCtx(a => a.mixin(DiffLogMixin))`), because a route models the mixin even where the columns don't.

- **Lexical is Signum's editor, and altea pins Signum's exact version.** `altea-html-editor` is a
  near-verbatim port (same package, same 0.45), so the extension protocol, the controller and the toolbar are
  Signum's. Divergences: `HtmlEditorMessage` lives in this package rather than in core (nothing else needs
  it); the LINE takes a `TypeContext` where Signum's takes a raw `Binding`, so it gets a label slot and
  validation styling; `getTimeMachineIcon` is dropped (no TimeMachine module) and so is Signum's
  `member.required` check (altea has an implicit NotNull validator instead); `AutoLineModal` becomes a local
  `EditLinkModal` whose three-way result is cancel / unlink / set. One Signum BUG is fixed rather than
  mirrored: `controller.editorState` is declared and read (every toolbar active state, the mandatory-empty
  check) but never ASSIGNED, so no button ever highlights — the OnChangeExtension now assigns it and calls a
  threaded `forceUpdate`. The server half is `HtmlToPlainText` for the excel generator: HtmlAgilityPack has
  no JS counterpart and the SERVER has no DOM (`DOMParser` is browser-only — the client half uses it), so it
  walks a ~100-line tokenizer, matching `ProcessNode` case for case.
  A TRAP worth knowing before choosing `HtmlSimple` for a template: the default extension set has no link
  support, so Lexical parses an existing `<a href>` back as bare TEXT and the anchor is dropped — and adding
  LinkExtension makes it worse, since `@lexical/link` normalizes any href it does not recognise as a url and
  turns a `@[m:url]` token into `mailto:@[m:url]`. Links belong in `HtmlComplex`.

- **Signum.Dynamic splits in two on one question: does the feature need a COMPILER?** `altea-dynamic` is
  the INTERPRETED half — `DynamicView` / `DynamicViewOverride` / `DynamicViewSelector` (a view is a JSON
  node TREE plus small JavaScript snippets, interpreted client-side), `DynamicCSSOverride` and
  `DynamicSqlMigration` (both plain text). The COMPILED half — `DynamicType`, `DynamicExpression`,
  `DynamicValidation`, `DynamicApi`, `DynamicTypeCondition`, `DynamicMixinConnection`, `DynamicIsolation` —
  does NOT port: each generates C# into a `CodeGen` directory, compiles it with Roslyn (via Signum.Eval)
  and restarts the app. The blocker is not the compiler (TypeScript has one and altea drives it) but that
  altea's entity model is stamped at BUILD time by the quote-transformer, so a runtime-invented type needs
  the transformer over generated source + a process restart + a schema sync — a design project, not a port.
  Signum.Eval itself DOES port (see altea-eval above), so the blocker is only the runtime-invented TYPE. The
  pieces re-homed here stay where they are: this package owns the admin pages, so it keeps its own
  `DynamicPanelPermission` beside altea-eval's `EvalPanelPermission`, and `registerDynamicPanelSearch` lives
  on `DynamicClient`; `TypeHelpComponent`'s one needed function becomes `client/View/FieldExpression.ts`.
  Consequences worth knowing:
  - it forced a CORE seam: `Navigator.ViewDispatcher` / `BasicViewDispatcher` / `setViewDispatcher` (altea
    resolved views inline, with a `// TODO: real ViewDispatcher` where the seam belonged), and
    `applyViewOverrides` now asks the DISPATCHER for overrides so a module can contribute them for a type it
    does not own.
  - the dispatcher's no-static-view FALLBACK deliberately differs from Signum's. In Signum a type with no
    registered view cannot be shown, so it offers to design a dynamic one; altea AUTO-GENERATES from the
    property routes, and many types rely on that — so it only ASKS when dynamic views actually exist.
  - a node's stored `field` reaches `subCtx` AS A STRING (altea's string overload parses a field path).
    It must NOT be turned into a runtime lambda: altea resolves a lambda through the `__quoted` tree the
    transformer stamps, and an eval'd function carries none.
  - suggested find options are ROOTLESS (`shipVia`, not Signum's `Entity.shipVia`), and they are computed
    from the REFLECTION metadata rather than by walking built table columns — which handles an
    `@implementedBy` field for free, where Signum needs a separate branch.
  - a FileType picker cannot be reflected: altea symbols are declared, not enumerated (there is no
    "SymbolContainer" TypeInfo kind), so the app registers them via `DynamicClient.registerFileTypes`.
  - not registered as nodes: `EntityList` and `ColorLine` (no such altea Line); `IconTypeahead` and
    `FileLine.dragAndDropMessage` have no counterpart either.

- **CodeMirror 5 → CodeMirror 6.** `altea-codemirror` keeps every wrapper's PROPS identical (`script` /
  `onChange` / `isReadOnly` / `errorLineNumber` / `innerRef`) and rewrites everything behind them: CM5 is
  end-of-life, ships no ESM entry points and no bundled types. So the options BAG becomes explicit props plus
  an `extensions` array (CM6 has no option dictionary — every feature is an Extension, and `readOnly` /
  `extensions` live in **Compartments** so they reconfigure without tearing the editor down);
  `addLineClass(…, "exceptionLine")` becomes a StateField holding one line Decoration (CM6 state, not a DOM
  side effect, so it re-maps through edits); the handle's `.codeMirror` (an `EditorFromTextArea`) becomes
  `.view`, and the `path` prop is gone with the textarea; F11 fullscreen is a class on the wrapper, not a CM5
  addon; and the dark theme (`@codemirror/theme-one-dark`) is resolved ONCE from `data-bs-theme` for every
  language instead of only in HtmlCodeMirror. C# is the one language with no first-party CM6 package, so it
  runs CM5's own `clike` grammar through `StreamLanguage` (`@codemirror/legacy-modes`). It is a **client-only
  package** (no data/, no server/). NEW here: `MarkdownCodeMirror`, standing in for Signum.Markdown's
  unported `MarkdownLine`.

- **SignalR → a WebSocket hub in altea CORE.** Node has no SignalR server and `@microsoft/signalr` speaks a
  protocol only that server implements, so `altea/server/webSocketHub.ts` + `altea/client/useWebSocket.tsx`
  re-create the hub abstraction over plain `ws`, narrowed to the three things Signum's hubs use: a stable
  connection id, GROUPS, and client→server method calls. One JSON object per frame — `{ m, a }`, SignalR's
  invocation message minus the envelope (there are no results to correlate: every hub method Signum declares
  returns void). No negotiation, no transport fallback, no streaming, no MessagePack. Two consequences:
  - a hub is registered on the `WebBuilder` but bound to the http.Server by `attachWebSockets(server)`, which
    the HOST calls after `listen` — an upgrade handler needs the server, not the Express app;
  - a browser WebSocket cannot send `Authorization`, so a connection AUTHENTICATES with its first frame
    (`$authenticate`), validated through the same authenticator chain an HTTP request uses. The token comes
    from `setAccessTokenFactory`, which altea-auth installs beside `setExtraHeaders`. Frames that arrive
    before authentication resolves are QUEUED, not dropped.
  `altea-concurrent-user` is its first consumer; it also trusts the socket's OWN user rather than the
  `userKey` the client passes (Signum trusts the argument), so a tab cannot register presence as someone else.

- **The agent's THREE missing .NET substrates.** `altea-agent` ports Signum.Agent, whose whole surface rests
  on packages with no JavaScript counterpart:
  - `Microsoft.Extensions.AI` (`IChatClient` / `ChatMessage` / `AITool` / `ChatOptions`) becomes
    `server/ChatClient.ts` — the SLICE the agent loop uses: four roles, streaming generation, tool
    declarations as JSON Schema, and a usage report. Seven Signum providers become THREE wire protocols:
    OpenAI's `/chat/completions` (which OpenAI, DeepSeek, GitHub Models, Mistral and Ollama all speak behind
    their five different SDKs), Anthropic's Messages API (with the system prompt lifted out and
    `cache_control` kept — the prompt IS the skill tree, and it repeats every turn), and Gemini's
    `generateContent` (whose schema dialect needs `toGeminiSchema`).
  - **Tools and skill properties are DECLARED, not reflected.** Signum marks a C# method `[McpServerTool]`
    and lets `AIFunctionFactory.Create(delegate)` reflect its signature into a JSON Schema; TypeScript erases
    parameter types, so `SkillCode.registerTool` takes the schema and the handler explicitly. Same for
    `[SkillProperty]` → `registerProperty` (which keeps `attributeName`, the key the client's property-editor
    registry uses). A `[UITool]` is `isUITool: true` with no `invoke`. The tool NAMES and descriptions are
    kept verbatim, because they are part of the prompt the model reads.
  - the MCP endpoint DOES use an SDK — `@modelcontextprotocol/sdk` is the same protocol's official JS
    implementation — but altea REFUSES an unauthenticated MCP request, where Signum leaves the policy to
    ASP.NET and Southwind adds none. These tools construct, execute and delete entities.
  Also: `AgentSymbol` is a plain `Symbol` (altea has no SemiSymbol, and every reachable agent is
  code-declared); `QueryDescription` is gone, so the `queryDescription` tool becomes `QueryTokens` over the
  token tree and `qd.NextAlternatives` becomes a walk to the longest valid token prefix; the query grammar the
  instruction files teach is altea's (ROOTLESS, camelCase fields, PascalCase system tokens, case-sensitive);
  and a tool result is serialized with `Serializer.stringify`, NOT `JSON.stringify` — a plain stringify drops
  a Lite's entity type (its `entityType` is a constructor), leaving the model unable to build a filter value.

- **Signum.Eval → altea-eval: a stored TypeScript module, type-checked with the TypeScript compiler.**
  `EvalEmbedded<F>` keeps Signum's shape — a script in a column, compiled on first use, cached, its
  diagnostics reported as a validation error on `script` — with `F` a FUNCTION type rather than an
  interface, because a TypeScript module's natural unit is a function and the generated module's DEFAULT
  EXPORT is the algorithm. Compiling is two passes: `ts.createProgram` over a virtual file for the CHECK
  (against the app's real `.d.ts`, the counterpart of Roslyn's MetadataReferences), then
  `ts.transpileModule` + `new Function` for the RUN. Divergences worth knowing:
  - **Signum's assembly / namespace lists become a MODULE REGISTRY** (`EvalLogic.registerModule(specifier,
    value, { typesPath, typeNames })`), and it is single-sided: the same entry resolves the import's TYPE and
    is what the sandboxed `require` hands back, so a script can only reach what the app registered
    (eastwind: `eastwindEval.server.ts`). `EvalLogic.addPreamble` is `GetUsingNamespaces()`. An APP's own
    modules need `typesPath` (nothing depends on the app, so there is no node_modules entry to follow), and
    a name that exists only as a TYPE needs `typeNames` (`specifierExporting` looks at runtime properties).
  - **`[BindParent]` has no counterpart**, so an eval's owner is bound by `sb.include(Owner).withEvals()`,
    which hangs off the `preSaving` and `retrieved` schema events (the retrieve also `reset()`s the cached
    compilation). Forget it and `owner()` throws by name. An eval carried by a MODEL is left UNBOUND on
    purpose — a ModelEntity is never included — so validation skips it and the real check runs when the model
    is applied and its entity saved.
  - the CHECK-EVALS registry is SERVER-side (`EvalLogic.registerEvalSource(name, load)`) where Signum keeps
    a list of client FindOptions: only the server can compile, and a filter Signum needs a QueryRequest for
    ("only lanes with an actors eval") is a `.filter(...)` here.
  - not ported: `TypeHelp` (the honest equivalent is editor IntelliSense over the same `.d.ts`),
    `GetCustomErrors`, and the EvalPanel PAGE — altea-dynamic owns the admin pages, so
    `EvalPanelPermission` lives here but `registerDynamicPanelSearch` stays on `DynamicClient`.
  - the editor is `altea-codemirror`'s `TypeScriptCodeMirror` inside one reusable
    `EvalLine` (Signum spells the signature / editor / closing-brace sandwich out inline in each of its
    eval views; there are ten of them here).
  - a compiled script runs IN PROCESS with the server's rights, exactly as Signum's Roslyn-compiled C# does.
    There is no sandbox; authoring one is gated by the owning entity's Save operation.

- **Signum.Workflow → altea-workflow: `withQuoted` is query-only.** The BPMN engine ports whole (designer,
  engine, inbox, case flow, activity monitor, script runner, scheduled starts), and its eight
  `EvalEmbedded<T>`s port as such through altea-eval (each subclass beside the entity that owns it; the eight
  `IXEvaluator` interfaces become the FUNCTION types in `data/WorkflowEval.ts`). One thing does reshape it:
  - **A `withQuoted` prototype member is QUERY-ONLY.** The transformer emits the quoted AST *beside* the body
    and leaves the body's inner lambdas unstamped, so calling one in memory throws "The following lambda has
    not been quoted" — Signum's `[AutoExpressionField]` members work both ways. Every other altea module only
    uses them inside queries, so the asymmetry never showed; the workflow ENGINE needs both, so each member
    has a plain query twin in `server/CaseQueries.server.ts` (same body). Signum's entity-level `PreSaving`
    override has no counterpart either — it is a schema event (`entityEvents(T).preSaving`), so those two
    bodies moved to the logic layer.

  Other divergences worth knowing:
  - **No ambient `EntityCache`, so nothing may be keyed by entity IDENTITY.** Signum wraps its graph build in
    `using (new EntityCache())`, which makes every `RetrieveAll` hand back one instance per row; altea gives
    each query its own Retriever, so a connection's `from` is a *different object* than the graph's node for
    the same row. `DirectedEdgedGraph` therefore takes an optional `keyOf` (core), and `fillGraphs`,
    `getAllConnections`, `trackId`, `LaneBuilder.getBpmnElementId` and the clone's old→new map all key by the
    lite key. An identity-keyed collection here silently joins nothing.
  - **`DirectedEdgedGraph<N,E>`** (edge-valued) is NEW in core beside `DirectedGraph<T>`; so are
    `Synchronizer.synchronizeAsync`, `server/xml/xml{Element,Document}` (promoted out of
    altea-office-template's `Oxml*`, which keep re-export shims) and `client/Basics/Color` (moved out of
    altea-chart, plus a `Gradient`). Core also gained the polymorphic-`ModelEntity` serializer branch that
    `BpmnEntityPairEmbedded.model` needs, `AuthLogic.rolesInheritingFrom`, and — surfaced here —
    `applyMetadata` now stamps each DECLARED symbol's id from the blob (a client symbol was `isNew`, so
    `toLite()` threw wherever a symbol is a filter value), `EnumCheckboxList` binds ORDINALS (it read
    `TypeInfo.members`, i.e. NAMES, which matched nothing), an index selector may walk EMBEDDED steps
    (`e => e.scriptExecution!.nextExecution`), and `Temporal.X.compare(a, b) <op> 0` translates to `a <op> b`
    (Temporal has no relational operators, so that IS how a date comparison is written in a query).
  - **The client's permission gate lives in altea-auth**, not core: `AuthClient.isPermissionAuthorized` reads
    an `allowed` flag stamped onto the permission container's own metadata entry (Signum ships a
    `permissions` side map and reads it through `AppContext.isPermissionAuthorized`).
  - **The Inbox is named by its ROW MODEL** (`InboxRowModel`, so `/find/InboxRowModel`), not by Signum's
    `CaseActivityQuery.Inbox` enum member — altea has no QueryDescription, so a manual query's name IS its row
    type and each caption is the field's own `@niceName`. Its tokens are camelCase literals: the SERVER's
    `QueryLogic.getToken` is a strict Map lookup, and `Type.token()` still PascalCases as Signum's
    `tokenSequence` did.
  - `MList<T>` is gone, so `mainEntityStrategies` / `actors` / `decisionOptions` / `viewNameProps` are `@part`
    rows — which is why the designer has its own main-entity-strategy checkbox list (core's
    `EnumCheckboxList` edits an array OF an enum, not of rows) — and `WorkflowActivityEntity.boundaryTimers`
    (Signum's VirtualMList) is a NON-PERSISTED `@column(false)` list the graph loader fills.
  - bpmn-js is pinned to Signum's exact 7.5.0 (+ diagram-js-minimap 2.0.4) with hand-written typings; the
    custom renderer / context pad / popup menu / minimap are Signum's. `componentWillReceiveProps` becomes
    `componentDidUpdate`. Signum's older navbar `WorkflowDropdown` is NOT ported (its toolbar menu config
    superseded it). altea has no `AutoLineModal`, so "pick an expiration date" and "edit remarks" are two
    small local modals.
  - Not ported: `MyActiveAlerts` (no Signum.Alerts), Signum's SMS module, `PackageExecuteAlgorithm<T>` (the
    timeout process walks its own package lines) and `registerWhenAlreadyFilteringBy`. (Instance
    translation of a workflow / activity name IS available now — see altea-translations below — but the
    workflow module does not opt its own routes into it.)

- **Signum.TimeMachine → altea-time-machine: the READER of a history that core already keeps.** Everything
  the page shows already exists — `@systemVersioned` tables, `SystemTime` (core's server/systemTime), the
  SearchControl's system-time dropdown — so the module is one route, one page and the quick link.
  Divergences:
  - **core's `getTimeMachineIcon` was a STUB and is now real** (`altea/client/Lines/TimeMachineIcon`): the
    per-line coloured dot that marks added / removed / changed / moved values is what the "UI differences"
    tab IS, and every Line already called it. Its vocabulary went into `EntityControlMessage`
    (`PreviousValueWas0`, `Moved`, `Removed0`, `Added`, `RemovedAndSelectedAgain`, `Selected`). No
    `translateX` (no altea Line passes one) and the checkbox variant reads `oldCtx.value` DIRECTLY (no
    MListElement) off the ENUM OBJECT rather than a TypeInfo.
  - **`PreviousOperationLog` is registered in CORE**, exactly where Signum registers it
    (`OperationLogic.registerPreviousLog`, on `schemaCompleted`, for every @systemVersioned table): the
    version grid's "who ran which operation" columns. `e.SystemPeriod().Contains(ol.End)` is spelled out
    against `.min` / `.max` — altea's `NullableInterval.contains` is an in-memory method, only the BOUNDS
    lower — which is also why `NullableInterval`'s bounds narrowed to `PlainDateTime` (a cast to a
    QUALIFIED type name is not quotable).
  - **`Administrator.SaveDisableIdentity` needs no counterpart**: altea's insert path already writes an
    explicit id into an identity PK when an entity is `isNew` with an `id`, so "restore this deleted row"
    is `isNew = true` with the id left alone. Signum's MList re-insertion block (its own "not tested"
    comment attached) disappears with MList: a `@part` row is an ordinary graph member.
  - eastwind marks `OrderEntity` `@systemVersioned`, as Southwind does — **so an existing database needs a
    `terminal sync` before the Time Machine has anything to read.**

- **Signum.Tour → altea-tour: an assembly of core seams plus driver.js.** The engine ports whole (the
  trigger model, the CSS-step discriminator, the editor, the player). Three pieces went into CORE where
  Signum keeps them: `TourTriggerSymbol` + `TourTriggerLogic` (Signum.Basics — so any module can declare a
  trigger without depending on the extension) and `TourButton` / `TourButtonOptions` (the renderer slot
  altea-tour fills). A fourth is NEW in core because Signum has it and altea did not:
  `EntityPack.extension` + `registerEntityPackExtension` (Signum's `EntityPackTS.AddExtension`), which is
  how the frame widget knows whether a tour exists without a round-trip. Divergences:
  - **`MList` → `@part` rows twice over** (steps, and each step's css steps), keeping Signum's
    `CssStepEmbedded` NAME as the AD configurations did; Signum's `WithVirtualMList` needs no counterpart.
  - **altea has no `PropertyRouteEntity`** (altea-auth keys a property rule by its route STRING), so a
    "Property" css step stores the `propertyString()` — and the SELECTOR it builds uses the route's LAST
    SEGMENT, because altea re-roots the PropertyRoute at each embedded and a Line's `data-property-path` is
    its own member (the divergence altea-playwright documents). Signum's PropertyRouteEntity delete cascade
    goes with the table.
  - **`cssSelector` lives in the DATA layer**, computed once, so the editor's live preview and the DTO the
    player consumes cannot drift (Signum computes it twice).
  - `EntityAccordion` is not ported, so the steps use `EntityTabRepeater`; `MarkdownLine` (Signum.Markdown,
    unported) becomes altea-codemirror's `MarkdownCodeMirror`; `PropertyRouteCombo` is local to this
    package (Signum keeps it in the framework, and altea has no other consumer);
    `getCurrentUserQuery` is a NEW `SearchControlLoaded` augmentation in altea-user-queries, derived from
    `extraUrlParams.userQuery` rather than a dedicated field.

- **Signum.Translation → altea-translations: a Signum ASSEMBLY is an altea PACKAGE.** Both halves port —
  the CODE half (which edits each package's own `translations/*.xml`, nothing stored) and the INSTANCE half
  (the `TranslatedInstance` table, for every `@translatable` route). The whole code half rests on that one
  mapping, and it is a clean one: translations already live per package, and every registered name knows
  its owning package through the transformer's `__fileInfo` (`getLocation`). Two renames follow —
  Signum's second grouping level is the C# NAMESPACE, here it is the declaring FOLDER; and
  `[DefaultAssemblyCulture]` is core's `setDefaultCulture`. Core gained three things for it:
  - **`@translatable` + `FieldInfo.translatable`** (`"Text"` / `"Html"` / `false` to switch a sub-tree off).
    It is on the COMPILE-TIME descriptor, so the client gets it for free — Signum has to ship it through
    `ReflectionServer.PropertyRouteExtension`.
  - **`PropertyRouteTranslationLogic`** (`altea/server/propertyRouteTranslation`), where Signum.Basics
    keeps it: the translatable-route registry and the swappable resolver. With the module absent every call
    falls through to the fallback, so a consumer needs no null checks. Its QUERY form is NOT ported —
    Signum swaps in a `TranslatedFieldExpression` through `As.ReplaceExpression`, which has no counterpart
    (the transformer stamps expression trees at BUILD time).
  - **a serializer hook** (`setTranslatedFieldProvider`): every translatable field an entity writes is
    followed by `<field>_translated`, so a Line can show the translation with no extra call — Signum ships
    the same property through a per-type JSON PropertyConverter.
  The instance half's ONE structural divergence simplifies most of it: **there is no rowId.** Signum keys a
  translation by (root instance, a route through an MList, rowId); altea has no MList, so a collection row
  is an ENTITY with its own lite and its own PropertyRoute root — the key is (culture, instance, route) and
  Signum's `LocalizedInstanceKey` triple, its MList primary-key parsing, the `"route;rowId"` composite key
  and `RemoveTranslationsForMissingRowIds` all collapse. Also:
  - the translators are ASYNC (no blocking in JS); the SDKs become their own REST calls (Azure's already
    was one; DeepL's `Translator` is three documented endpoints), and the proxy option is dropped
    (`HTTPS_PROXY` instead). `AlreadyTranslatedTranslator` reads the package files rather than assemblies.
  - `PlainExcelGenerator` gained `writeStringTable` / `readStringTable` — the honest counterpart of
    Signum's reflection-driven `WritePlainExcel<T>(List<T>)`, since TypeScript erases the member list.
  - NOT ported: `countLocalizationHits` (Signum counts un-translated hits per role to order the sync page;
    that would put a counter on the framework's hottest path), and the TERMINAL commands `SynchronizeTypes`
    / `CopyTranslations` — altea has neither problem, since a package's `translations/` IS the source and
    nothing is copied at build time.
  - `NaturalLanguage` gained `tryGetGenderFromDeterminer` / `determinersFor`, which the gender round-trip
    (ask for "el pedido", read the gender back off the article) and the gender picker need.

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

## How to test in a browser (eastwind e2e)

The app's Playwright suites live in `eastwind/test/` and drive the real UI through the page objects of
**@altea/altea-playwright** (Southwind.Test.React's counterpart). They run against a RUNNING stack:

```bash
pnpm --filter eastwind test:e2e
```

That is `tspc -b && playwright test`, and the build is not optional: a spec addresses lines with property
LAMBDAS (`frame.lines.textBox(o => o.shipName)`), which only work once the quote-transformer has stamped
them — so Playwright runs the COMPILED specs (`testDir: dist/test`), never the `.ts`. Point it elsewhere with
`EASTWIND_E2E_URL` (default `http://localhost:5173/`). First run on a machine: `npx playwright install chromium`.

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
