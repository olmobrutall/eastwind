# eastwind — the Southwind port ledger

**What eastwind does differently from Southwind, and why.** Southwind is Signum's demo application;
eastwind is its port onto altea. This file holds the differences that are the APPLICATION's rather
than the framework's — the framework's are in
[`../../altea/port/port.md`](../../altea/port/port.md).

Everything in this FILE exists because eastwind was PORTED. A new application built from eastwind does
not need it, which is why `Modules.xml` has a `port` module that removes it (plus the legacy-mode
environment files) — unticked by default, so a fresh clone drops it. It sits in `docs/` beside
`Wiring.md` rather than in a `port/` directory of its own — the app-level counterpart of the submodule's
`altea/port/` — because one file is not a directory.

The one-off checks a port wrote against a real database live in `terminal/probes/` and are GITIGNORED:
scratch scripts for one session's question, kept on disk because re-running one beats rewriting it, but
not source this application ships. The one-off data migrations that converted a Signum-shaped database
(`migrate*.ts`) are gone entirely — that work belongs in a `.sql` migration or in `terminal sync`.

| Southwind (C#) | eastwind (TypeScript) |
| --- | --- |
| `Southwind/` — entities, logic and React by domain | `eastwind/app/<domain>/` — the same domains, one folder each |
| `Southwind/Starter.cs` | `eastwind/app/starter.server.ts` |
| `Southwind/MainAdmin.tsx` / `MainPublic.tsx` | `eastwind/app/MainAdmin.client.ts` / `MainPublic.client.tsx` |
| `Southwind.Server/` | `eastwind/app/webServer.server.ts` |
| `Southwind.Terminal/` | `eastwind/terminal/` |
| `Southwind.Test.React/` | `eastwind/test/` (Playwright) |

- **The Northwind SOURCE database is seeded, on either dialect, and its images come off disk.** Southwind
  assumes a Northwind database is already installed (the SQL Server sample everyone had), so
  `NorthwindSchema.cs` needs no seed and no dialect question. eastwind runs on both, so `terminal
  seed-northwind` — also the FIRST `ts` migration, so that command is self-contained — creates it from
  the vendor script matching `NORTHWIND_DB`'s own prefix: `Northwind.SqlServer.sql` (Microsoft's
  `instnwnd.sql`, `GO`-separated) or `Northwind.Postgree.sql` (the pg_dump port, `;`-separated). **Both run
  VERBATIM** — the seed only SPLITS them into the units a driver accepts (neither driver takes a script
  containing `GO`; node-postgres takes one statement per parameterised call), and rewrites no SQL at all.
  One statement is DROPPED and it is the only exception: `SET default_with_oids` names a parameter
  PostgreSQL removed in 12. The two things the scripts disagree about are settled where each belongs:
  - **NAMING** — SQL Server is PascalCase under `dbo`, the pg_dump is snake_case under `public`. A view maps
    each column by FIELD NAME VERBATIM, so this used to mean rewriting the dump's identifiers; instead
    `ViewBuilder` gained two override points, **`tableName(typeInfo)` / `columnName(fi)`**, and `Schema` a
    swappable **`viewBuilder`** slot. The `Nw*` classes are declared once in Northwind's own SQL Server
    spelling and `NorthwindPostgresViewBuilder` (eastwind's, ~15 lines: one PascalCase→snake_case rule plus
    `HomePage` → `homepage`, which the dump spells as one word) maps them for the Postgres source. It is
    installed on the NORTHWIND connector's own Schema, so nothing else in the app sees it — which works
    because `view()` resolves through the CURRENT connector's schema, and `Northwind.connector()` builds its
    own. That is the general seam for reading a FOREIGN database (one altea neither generates nor
    synchronizes) whose spelling is not altea's.
  - **IMAGES**, the only real DATA difference: `Categories.Picture` / `Employees.Photo` are ~700 KB of
    OLE-wrapped bitmap as `0x…` literals in the SQL Server script and an EMPTY bytea in the Postgres one.
    Neither wins, and neither is MAPPED by any view — so whatever a script puts there is never read, and the
    loaders take the pictures from `terminal/northwind/image_categories` + `terminal/northwind/image_photos` instead
    (`northwindImages.ts`, by base name with the extension discovered from the directory), the same bytes on
    both dialects. Hence no `Picture` column on `NwCategory` and no `RemoveOlePrefix`. A category name may
    hold a slash, so ONE mechanical rule maps it to a file (`Grains/Cereals` → `Grains-Cereals`); an
    employee photo is `<FirstName> <LastName>`.
    `EmployeeEntity.photo` is a `FileEmbedded` where Southwind holds a `Lite<FileEntity>` — the shape
    `CategoryEntity.picture` already uses, so the demo needs no FileEntity table and no FileType of its own.
    **An existing database therefore needs a `terminal sync` before an employee photo has a column to live
    in.**

- **App settings are ONE persisted row, and every module start takes a lambda to it.** eastwind ports
  Southwind's `ApplicationConfigurationEntity` (`eastwind/app/globals/`): one row per environment carrying each
  module's configuration embedded (mail, chatbot, workflow, SMS, and the three directories), edited at
  `/view/ApplicationConfiguration`, and each `Logic.start` receives `() => GlobalsLogic.configuration().x`
  exactly as Signum's `EmailLogic.Start(sb, () => Configuration.Value.Email, …)` does. The per-module
  `eastwind<Module>.server.ts` files keep only what is genuinely app CODE (skill trees, email owners, ORDER
  as a case main entity, the store factory); nothing there reads `EASTWIND_*` for a setting any more, and
  neither does the migration that CREATES the row — `CreateCulturesAndConfiguration` seeds plain dev
  defaults and leaves every credential empty, so the row is the only source of truth from the first run.
  Divergences:
  - **which row is `DB_ENVIRONMENT`**, matched against `environment`, where Signum matches `DatabaseName`
    against `Connector.Current.DatabaseName()` (altea's Connector exposes no such name, and a deployment
    controls an env var anyway). `databaseName` is declared and SEEDED all the same — a Southwind database
    has the column with a value in it, and dropping it is data loss over a difference in which field is
    the key — but nothing reads it. The seed derives it from the connection string (a URL's last segment,
    or the `Database=` key), which is what Signum's value means. Unlike Southwind's view, eastwind's
    RENDERS it: nothing else writes it, so a row that predates the column (the sync defaults it to `''`)
    would otherwise fail its min-length validator on the next save of ANY setting, with no field to fix.
    The entity carries a `@quoted isActive()` so the search page can say which
    row is live; the value it compares against is a module CONST in the DATA layer, read off `globalThis`
    (that layer is isomorphic and ships no node types) — the transformer captures a free identifier by
    value, so a `process.env` read inside the quoted body would have no SQL translation.
  - **the lazy is mirrored into a SYNC snapshot.** altea's ResetLazy is async while every module's
    configuration getter is sync, so `GlobalsLogic.warmUp()` fills a snapshot after `schema.initialize()`
    (the pattern `CultureInfoLogic` already uses) and the `saved` event refreshes it — which is what makes
    an edit take effect without a restart, as Signum's `InvalidateWith` does.
  - **what stays in the environment** is what Southwind also keeps in `appsettings.json`: the connection
    string, the file-store BACKEND + its cloud credentials (Signum's `azureStorageConnectionString` is a
    `Starter.Start` parameter), `NORTHWIND_DB` (the terminal's demo-data SOURCE — see the bullet below), and
    `EASTWIND_AD_PROVIDER` — which directory owns the login flow, decided while the schema is built, before
    a row can be read.
  - **Southwind's `Folders` member is NOT ported.** It stores one editable path per local file store; here
    a store's folder is derived from the store's own NAME — `EastwindFileStores.store("help-images")` writes
    to `./files/help-images`, and the same name is the Azure container / S3 bucket, so it is KEBAB-CASE and
    checked at registration (those two accept only lower-case letters, digits and hyphens; Southwind hits
    the same rule by hand, since it passes the configured folder straight to `new BlobContainerClient`).
    The paths were never a
    deployment choice (every one read `./files/<the store name>`), and as data they were five more rows to
    keep in step with the code that names the stores.
    - **the ROOT is a variable, and LEGACY mode is the only reason.** Pointing eastwind at a database a
      Signum application generated points it at that deployment's FILES too: every file-backed row holds
      a suffix relative to whatever Southwind's `Folders` was set to (`c:/SouthwindFiles/operation-logs`),
      so a derived `./files/operation-log` finds nothing and the retrieve of that row FAILS — `ENOENT` out
      of BigStringLogic's File-mode read, which Signum throws on too, taking the entity page and every
      contextual menu with it. Hence `EASTWIND_FILE_STORE_ROOT` (default `./files`) plus a legacy-only
      alias for the seven stores Southwind spells differently (`operation-log` → `operation-logs`,
      `cached-queries` → `cached-query`, `help-images` → `help-image`, `predictor-files` →
      `predictor-models`, …). Still not the ported member: ONE root for every store, and the per-store
      path stays derived. Local stores only — an Azure container / S3 bucket is `eastwind-<name>` here and
      a Southwind deployment's cloud configuration has no counterpart. It comes from the environment for
      the same reason the dialect and LegacyMode do: a store is registered while the schema is BUILT.
    - **a BigString's file is named by `storedMemberName`**, so it is `InitialState.txt` in legacy mode and
      `initialState.txt` otherwise. Signum names it after the C# PROPERTY (`pr.PropertyInfo!.Name + ".txt"`)
      and that name is written into the stored SUFFIX, so the two deployments must agree on it — on a
      case-insensitive store the folder is what saves a mismatch, nowhere else. Same helper a stored
      property route goes through, rather than a second rule that could drift from it.
  - **the three configuration members Southwind has and eastwind does not are IGNORED by a legacy sync,**
    rather than renamed or dropped: `Folders_*` (above), `Translation_*` (@altea/altea-translations reads
    its two translator credentials from the environment) and `AuthTokens_*` (altea's counterpart is a
    server-side interface taken eagerly from the host). Left alone the synchronizer offers each as a
    RENAME of whatever model column sorts nearest by string distance — `folders_view_log_folder` →
    `open_id_scopes` was a real offer — and DROPs the ones the developer declines, which deletes what a
    Signum deployment configured over a difference of MODEL. So they are removed from the database
    description before it is diffed, through a NEW core seam: **`simplifyDiffTables`**
    (`server/sync/schemaSynchronizer`), Signum's `SchemaSynchronizer.SimplifyDiffTables`. It runs after
    the history tables are lifted out and before the first question is asked of the diff — one step
    earlier than Signum's literal position, ahead of altea's own schema-move pairing, since that pairing
    is a matching decision too — so a removed table or column takes no part in any prompt, DDL, index or
    foreign-key follow-up. An ARRAY where Signum has a single Action (several modules may each know about
    their own tables), and Signum's sibling `IgnoreTable` needs no counterpart: a handler can delete a
    key from the map. NORMAL mode is untouched — there the database is one altea generated, so it has no
    such columns.
  - **a renamed symbol CONTAINER is re-keyed, not ignored** — `renameSymbolContainer(container, to, members?)`
    (`data/reflection`),
    the symbol-key sibling of `@legacyTableName` / `@legacyColumnName` and NEW here. A symbol's key is
    `<Container>.<Member>` and it IS the `key` column of that symbol's table, so this app's
    `EastwindTypeCondition.UserEntities` reads against a Southwind database as a symbol that does not
    exist plus one that is gone. Ignoring the difference is not enough here (unlike the enum members
    above): the ROWS are FK targets, so the model must end up on the database's spelling, not merely
    leave it alone. In legacy mode eastwind re-keys `EastwindTypeCondition` → `SouthwindTypeCondition`
    and `EastwindAgentUseCases` → `SouthwindAgentUseCases`.
    The container is the NAMESPACE OBJECT, not its name: a string would be a second spelling of what the
    compiler already knows, stale after a rename and silently wrong after a typo — and passing the object
    finds the symbols by IDENTITY rather than by a key prefix. An optional third argument renames the
    MEMBERS, its keys `keyof` the container so they are checked the same way. That is what the Word →
    Office rename needs (`CreateOfficeReport` was `CreateWordReport`), and the mapping lives in
    @altea/altea-office-template's own `useLegacyWordSymbolNames()` beside the `@legacyTableName`s it
    already declares — the module owns what it used to be called, the app owns knowing which database it
    is pointed at. Registering it surfaced that
    `OfficeTemplateOperation.CreateOfficeTemplateFromOfficeModel` was DECLARED and never registered, so
    the operation did not exist at runtime (both helpers it needs were already there — Signum's
    WordModelLogic registers it on the template's graph from the model).
    In legacy mode a condition eastwind ADDS is inserted under that container too
    (`SouthwindTypeCondition.PublishedNews`) — one container name per mode is what makes the rename work.
    It is called from the app's shared entity-overrides module, NOT the Starter, because BOTH TIERS
    must agree — the key is model identity, and a client still saying `Eastwind*` could not be handed
    the symbol's id by the metadata blob, so every `toLite()` on it would throw. That module is also
    the one place that runs before anything reads a symbol by key. It THROWS when the container matched
    nothing, since a typo and a call made too early are the same silent no-op otherwise.
  - **`CurrentEmployee` is registered**, Southwind's third condition (`TypeConditionLogic
    .Register<OrderEntity>(…, o => o.Employee.Is(EmployeeEntity.Current))` — "the orders I handled").
    Every ingredient was already here — the `UserEmployeeMixin`, the "Employee" claim it fills, and
    `EmployeeEntity.current()` reading it — and only the condition was missing, so a Southwind database's
    row had nothing to match and the sync offered to rename it into an unrelated condition. Declaring it
    grants nothing by itself (a condition only bites once a role has a RULE using it, and neither
    eastwind's AuthRules.xml nor Southwind's own database has one); it exists so the symbol does.
  - **`simplifyDiffEnums` is its sibling for an enum table's ROWS**, and NEW — Signum has no such seam,
    having no second framework to line its enum tables up with. A handler gets one table with BOTH sides
    of the row diff and may delete from either; it runs before the RENAME question, which is what makes
    it useful. `ExceptionOrigin` is the case: altea calls the members `Backend` / `Frontend` where Signum
    writes `Backend_DotNet` / `Frontend_React` (naming a member after the TECHNOLOGY dates it, and the
    plain word says as much). Signum is taking the same two names, so the table converges on its own —
    until it does, a legacy sync leaves those rows alone rather than renaming a Southwind database's data
    because a second application looked at it. Clear BOTH sides, never one: a model member whose database
    row is hidden becomes an INSERT, colliding on the id that row still occupies.
  - **the enum ROW sync emits Signum's three phases, and its temp-id pass.** Both were missing and both
    produced scripts that fail on the primary key. altea had ONE flat loop over the union of the names,
    which put the creates FIRST (the union is built model-side first) — so a member removed at id N and
    another added at the same id inserted before deleting; Signum's `SyncEnums` emits every DELETE, then
    every merge, then every INSERT. And a member whose id CHANGED was re-inserted at that id even while
    another row still held it; Signum first moves such members aside to `id + 1_000_000`, runs the
    ordinary diff over everything else, then brings them back — three passes, which is what a SWAP of two
    members' ids needs. Both are ported now (`syncEnums`), so an id swap scripts nine statements that
    each hold: every incoming reference is moved before the row it points at is deleted.
  - **the AD configurations became `@part` ENTITIES** (`BaseADConfigurationEmbedded extends Entity`), because
    persisting them means persisting `roleMapping`, and a collection is `@part` child rows whose back
    reference needs a real owner TABLE — which a flattened embedded is not. Same reshaping altea-email
    applied to `SmtpNetworkDeliveryEmbedded`; Signum's names are kept, "Embedded" suffix included. The ROW
    type is declared per module (`AzureADConfigurationEmbedded_RoleMapping`, …) rather than shared, since a
    `@part` collection is keyed by ONE back reference — three directories sharing one row type on one owner
    would read each other's rows — hence `BaseADConfigurationEmbedded.roleMappings()`, the accessor the
    shared ADAuthorizer reads.
