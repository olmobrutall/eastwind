# eastwind wiring — the ordering ledger

The three bootstrap files (`starter.server.ts`, `MainAdmin.client.ts`, `MainPublic.client.tsx`) are
eastwind's counterpart of Southwind's `Starter.cs` / `MainAdmin.tsx` / `MainPublic.tsx`. They are
deliberately kept as THIN as Southwind's — one line per module — and every "why is this call here and not
there" note that used to sit inline lives in this file instead, keyed by module.

Read this before moving a call. Most of these constraints are invisible at the call site: a module
started too early mounts its routes ahead of the auth middleware, and one started after the registry it
writes into has been read contributes nothing.

## The shape: DEPENDENCY ORDER

Both `starter.server.ts` and `MainAdmin.client.ts` read top to bottom as a dependency graph, in banner-
separated tiers:

> framework (`@altea/altea`) → authorization → files → directory login → scheduling and processes →
> eval → user assets → communication → documents → print/news → machine learning → dynamic and workflow
> → cross-cutting (navigation, docs, logs, presence) → **the app (eastwind)**

Nothing depends on the application, so its own domains come LAST — which also means a module start that
takes an app type as an argument (`AlertLogic.start(sb, { registerExpressionsFor: [UserEntity,
OrderEntity] })`) runs before that domain's `include`. That is fine and worth knowing why: registering an
expression stores a ctor-keyed entry and touches no table, and every symbol registry below is read
through a thunk.

## The rules that decide the order

1. **Almost every symbol registry is read through a THUNK, so registration order does not matter.**
   `SymbolLogic.start` stores `getSymbols` and calls it only when the table is GENERATED / SYNCHRONIZED /
   LOADED — all of which happen after the whole schema is built. So an operation, a scheduled task, a
   process algorithm or a file type registered *after* its module's `start` is still seeded. This is why
   `OperationLogic.start` sits with the framework at the TOP rather than last: it used to be documented as
   "call after the graphs have registered", which was never true of the thunk. What genuinely must follow
   it is whatever DECORATES the operation log — `DiffLogLogic`, `TimeMachineLogic`.
2. **Express matches handlers in REGISTRATION order.** A module whose routes are mounted before
   `AuthLogic.start` never sees an authenticated user — every call answers "Not user logged". Hence
   `FileLogic`, the directory modules, `CacheServer`, `ChatbotServer`, `PrintingServer` and
   `WhatsNewServer` all come after it, and `SignumServer.start` is last of everything (its JSON exception
   filter is Express error middleware, which must be last).
3. **A model decision must precede the schema build.** `EntityOverrides.start` (mixins, lite models,
   `implementedBy` widenings), `sb.settings.*`, `configureBigString` and `sb.settings.ignoreFieldRoute`
   all run before the first `include`, because each decides which COLUMNS a table has.
4. **`CacheLogic.start` is first of all module starts.** It swaps the global-lazy invalidation strategy,
   which must happen before any `sb.globalLazy` registration, and `.withCache()` on an include needs it.
5. **A registry's consumer comes after its producers.** The dashboard part registry, the toolbar content
   configs, the omnibox generators and the chart script catalogue are each read by a module that must be
   started after whoever writes into them. This is the rule the tier order mostly encodes.
6. **`GlobalsLogic.start` is last of the includes.** The `ApplicationConfiguration` row references an
   `EmailSenderConfiguration` and embeds each module's configuration type, so those includes must already
   exist. Every configuration lambda above it is lazy, so nothing reads a value before the warm-up.

## Server modules (`starter.server.ts`)

| Module | Constraint |
| --- | --- |
| `EntityOverrides` | First. Mixins + `implementedBy` widenings are part of the MODEL, so they decide which tables exist. Runs identically on the client (`MainPublic` boot). |
| `connector.detectServerCapabilities()` | Before the schema is built: it decides a generated uuid key's default generator (`uuidv7()` vs `uuid_generate_v1()`). Signum detects in its connector constructor; altea has no synchronous DB access. |
| `implementedByAllPkType("uuid")` | Southwind's `ImplementedByAllPrimaryKeyTypes.Add(typeof(Guid))` — the thirteen user-asset row types have uuid keys. Default is Signum's `{int}`; nothing here declares a `long`. |
| `legacyMode` | Point eastwind at a database a SIGNUM application generated, so `terminal sync` reads as a migration rather than a rebuild. From the environment (`LegacyMode`), because it is decided while the schema is BUILT. |
| `configureBigString` | Before any of the five log types is included — registering a route is what DROPS the column the chosen mode does not use. |
| `CacheLogic` | First module start (rule 4). The broadcast tells SIBLING processes to invalidate: `PostgresBroadcast` (LISTEN/NOTIFY) on Postgres, nothing needed for a single-process host. Loaded lazily so a SQL Server host does not pull in the `pg` driver. |
| `CultureInfoLogic` | Early — an email / Office template REFERENCES a culture row. |
| `AuthLogic` | The two user names are Southwind's. The SECOND is the app's unauthenticated posture: a request with no token is authenticated as "Anonymous" and limited by that role's rules (`terminal/AuthRules.xml` grants it Read on Category + Product — the public catalog). |
| `FileLogic` | After `AuthLogic` (rule 2). Its field scan runs on `schema.initializing`, so it still covers every module's file fields wherever it sits. |
| `BigStringLogic` | Installs the hooks for the routes `configureBigString` registered, and ASSERTS at `schema.initialize()` that every BigString route has a configuration. Signum only finds out on the first save. |
| Directory modules (AzureAD / OpenID / WindowsAD) | After `AuthLogic` (rule 2), after `FileLogic` (the cached-photo store needs the FileType table), before `SchedulerLogic` (their `SimpleTask` must be registered before that table is seeded). At most ONE owns the login flow — see `eastwindAuthAD.server.ts`. OpenID is started always so the client's boot probe is a clean 200-null rather than a 404. |
| `SchedulerLogic` | Anywhere: the `SimpleTaskSymbol` table is seeded from a thunk, so the app domains at the bottom still contribute their tasks (rule 1). |
| `ProcessLogic` / `PackageLogic` / `ProcessSchedulerBridge` | Same thunk rule — PackageLogic’s own header says so outright. The BRIDGE goes last of the three: it makes a `ProcessAlgorithmSymbol` a valid `ScheduledTask.task`; the matching `implementedBy` widening is in `entityOverrides.data.ts`. |
| Agent | Skill CLASSES first (the `SkillCode` table is seeded from them and `registerAgent` asserts against it), then the chatbot's own agent, then the app's MCP agent. After the chart module — `ChartSkill` reads the registered scripts. |
| `ConcurrentUserLogic` | After the auth logics (its hub authenticates with the same bearer token) and after `CacheLogic` (two receivers on the server broadcast). |
| `ProfilerLogic` | After the auth logics so its three permissions land in the same seed. Southwind passes all three flags; each flag is what REGISTERS the matching permission. The session-timeout override itself is still deferred in altea. |
| `PredictorLogic` | After `ProcessLogic` — the Autoconfigure genetic search registers itself as a process algorithm. |
| `TokenMigrationLogic` | FIRST of the user-asset modules: each registers its token-synchronizing subscriber only `if (TokenMigrationLogic.isStarted())`. Its directory is the SQL migrations' one — a `.tokens.json` sits beside the `.sql` whose renames caused it. |
| `UserQueriesLogic` / `UserChartLogic` / `ChartLogic` / `ColorPaletteLogic` | `UserChartLogic`'s `ChartScriptSymbol` FK auto-includes the chart-script table, which `ChartLogic.start` seeds. `svgMapUrls` registers the opt-in SvgMap chart with the sample map served from `public/`. |
| `DashboardLogic` / `CachedQueryLogic` | After the two asset modules so their part types are in the dashboard part registry before a dashboard is imported. The snapshot store is read far more often than written — hence a store the app can point at object storage. |
| `ToolbarLogic` | After UserQueries / UserChart / Dashboard so their CONTENT CONFIGS are registered before a toolbar response is built. |
| `TourLogic` | After `DashboardLogic` / `UserQueriesLogic`: a tour's trigger is `@implementedBy(Type, TourTrigger, Dashboard, UserQuery)`, and it hangs "drop stale steps" cascades off those two types' schema events. |
| `EastwindEval` | Before every module whose entities carry an `EvalEmbedded`: an email / Office template's `applicable`, and the workflow's eight. |
| `ResetPasswordRequestLogic` | BEFORE `EmailLogic.start` — its two email models must be in the registry when the `EmailModel` table is seeded. |
| `EmailLogic` | After `FileLogic` (attachments are `FilePathEmbedded`s in a real store). The app supplies only the two configuration members; the USER email owner and the default master template are the MODULE's. |
| `EmailPackageLogic` / `SendEmailTaskLogic` | After `EmailLogic` and after `SchedulerLogic` / `ProcessLogic`, whose registries they write into. |
| Reception (`Pop3ConfigurationLogic` / `EmailReceptionLogic`) | After `EmailLogic` (the EmailMessage table + attachment store). Its sweep `SimpleTask` registers after `SchedulerLogic.start`, which is fine — the declared-symbol list is read through a thunk. |
| `RemoteEmailsLogic` | OPT-IN (`EASTWIND_REMOTE_EMAILS`): every row is a live Microsoft Graph call, so without a tenant it would only ever show an error. |
| `AlertLogic` / `NoteLogic` | After the auth logics (an alert is addressed to a USER). `registerExpressionsFor` is Southwind's `(typeof(UserEntity), typeof(OrderEntity))`. |
| `AlertNotificationLogic` | After `EmailLogic` (registers an email model) and `SchedulerLogic` (registers a task type). |
| `OfficeTemplateLogic` | After altea-email — an OfficeAttachment hangs off an EmailTemplate. |
| Excel (`PlainExcelLogic` / `ExcelImportLogic` / `ExcelReportLogic`) | Three separate starters so an app can offer export without import; Southwind starts all three with one `ExcelLogic.Start(sb, excelReport: true)`. `ExcelReportLogic` needs QueryLogic running (the entity has a `QueryEntity` FK). |
| `DynamicLogic` | The COMPILER is configured first — a `DynamicType` is generated as TypeScript, compiled with the quote-transformer and loaded. `codeGenDirectory` is Signum's CodeGen folder; `typesRoots` points at the app's **dist**, because nothing depends on an app so there is no node_modules entry for TypeScript to follow (pointing at the SOURCE type-checks and then fails at load). |
| `WorkflowLogicStarter` | After scheduler (timeout sweep is a SimpleTask), processes (the timeout process algorithm) and auth (a lane's actors are users/roles). Southwind starts the module but declares no main entity, so nothing could run through it; eastwind makes ORDER one. |
| `OmniboxLogic` → `MapLogic` → `HelpModuleLogic` → `TreeModuleLogic` | Each of the last three pushes a generator onto `OmniboxParser.generators`. The array is read per request, so the order is only for readability — the same order Southwind uses. The tree TYPE (`DepartmentsLogic`) is separate and sits with the app domains. |
| `SMSModuleLogic` | `provider` is deliberately UNSET — Signum ships no gateway and Southwind passes null, so sending answers "No ISMSProvider set" until an app supplies one. The `SMSMessages` sub-token is registered PER CONCRETE TYPE; the "send to all of these" OPERATION is registered ONCE on the abstract base (an operation is keyed by its symbol and a subclass inherits it). |
| `PrintingLogic` | After `SchedulerLogic` (a SimpleTask). `PrintingLogic.print` is deliberately UNSET — its default throws, as Signum's does, because what "print" means is an app decision. The TEST file type IS supplied, so `CreateTest` has somewhere to upload; Southwind passes none. |
| `WhatsNewLogic` | The two FILE TYPES are the module's own; eastwind points both at one folder. The PUBLISHED type condition is what makes a Draft invisible to a non-admin. |
| `ViewLogLogic` | `registerExpressionsFor` is Southwind's exact set — the three user assets. The two subscriptions it installs are core seams, so nothing else needs to know it is here. |
| `TranslationLogic` | Default translator chain is the offline "already translated elsewhere" one, so no API key is needed. |
| `OperationLogic` | With the FRAMEWORK, at the top — rule 1. Its symbol list is a thunk, so the graphs may register on either side of it. |
| `DiffLogLogic` | After `OperationLogic`, whose `OperationLogEntity` table it decorates. `registerAll` is Southwind's setting: dump EVERY type. |
| `TimeMachineLogic` | After `OperationLogic` — the `PreviousOperationLog` column it shows is registered there. What it browses is the history of `@systemVersioned` tables (eastwind: `OrderEntity`, as Southwind marks it). |
| `GlobalsLogic` | LAST of the includes, exactly where Southwind calls it — rule 6. |
| `DynamicLogic.compileDynamicCode` … `startDynamicModules` | Before `sb.complete()`, because a schema is built once. A compile failure is recorded rather than thrown (the server must boot so a bad definition can be fixed) and `registerExceptionIfAny` says so loudly — including that a `sync` would now script DROPs. |
| `Starter.initialize` | Everything that READS the database. Separate from `start` because WHEN it happens differs by host: the web host initializes at boot, the TERMINAL does not (its menu appears first and only data commands initialize). Initializing before `sync` means a wall of mismatch warnings in front of the command that would fix them. |
| The three background runners | **Not in the Starter at all** — they live in `webServer.server.ts`, a few seconds after the host is listening. Picking work up is the WEB HOST's job: a terminal command or a test builds the very same schema and must not start executing processes, scheduled tasks and queued mail behind itself. |
| `SignumServer.start` | Last (rule 2). |

### `configureBigString`

A `BigStringEmbedded` is a wrapper around one unbounded text column; `BigStringMixin` hangs a
`FilePathEmbedded` off it, and `BigStringLogic` writes the text out on save and reads it back on retrieve,
so nothing that reads `.text` changes. Southwind picks `File` for all five log types and one store each —
separate stores because a deployment may want the exception dumps somewhere different from the e-mail
bodies. `registerAll` configures every `BigStringEmbedded` route of the type (`ExceptionEntity` has three).

Switching an EXISTING database from `Database` to `File` is **not** just a `sync`: the sync would drop the
text column and the rows would lose their text. Signum's answer, which altea ports, is to deploy once with
`Migrating_FromDatabase_ToFile` (both columns exist, every save moves the text across), run
`BigStringLogic.migrateBigStrings(T)`, then switch to `File`.

Every BigString route in the schema is one of those five. There used to be five more — a package's config
string, a process / scheduler exception line's element info, a scheduled task log's remarks — registered
`Database` purely to stop the mixin giving them file columns nothing wanted. Signum declares all five a
plain `string?`, so they are plain strings here now and the question does not arise.

### The legacy-only diff simplification

`ignoreConfigurationsForLegacyOnly` — the columns a legacy `ApplicationConfigurationEntity` stores and
eastwind's deliberately does not: `Folders_*` (here a store's folder is derived from the store's own NAME,
so the paths cannot drift from the code that names the stores), `Translation_*` (altea-translations reads
its two translator credentials from the environment) and `AuthTokens_*` (altea's counterpart is a
server-side interface taken eagerly from the host). Left to itself the synchronizer offers each as a
RENAME of whatever model column sorts nearest by string distance — `folders_view_log_folder` →
`open_id_scopes` was a real offer — and DROPs whatever the developer declines. Both answers are wrong: the
columns are not misnamed, and they hold what a Signum deployment configured.

It is a NORMAL-mode no-op: there the database is one altea generated, so it has no such columns.

There used to be a second one, `ignoreRenamedEnumMembers`, for `basics.exception_origin` holding
`Backend_DotNet` / `Frontend_React`. Signum has since taken altea's two names (`Backend` / `Frontend`), so
the table converges on its own and the seam is gone.

## Client modules (`MainAdmin.client.ts`)

`cb.startFramework()` is Southwind's `Operations.start()` / `Navigator.start()` / `Finder.start()` /
`QuickLinkClient.start()` in one call — one `ClientBuilder` owns the routes and is threaded through every
`start(cb)`, mirroring the server's single `SchemaBuilder`. Importing a `*Client` module is also what
registers its entity types on the client (needed for token resolution and operation→type mapping).

| Module | Constraint |
| --- | --- |
| `CultureInfoClient` | Before the template modules, whose `culture` fields reference it. |
| `HtmlEditorClient` / `MarkdownClient` | Register a CELL FORMATTER only ("Html" / "Markdown" query-column format). Before the modules whose searches have such columns (the email + office templates). The EDITOR / `MarkdownLine` are line components the views import directly. |
| `AuthAdminClient` | Before `GlobalsClient` — which overrides the User view, and overriding a view whose `EntitySettings` the builder has not created yet makes `withView` throw "Key User already added". Southwind orders these two the same way. |
| `ActiveDirectoryClient` | `inviteUsers: true` gates itself on `ActiveDirectoryPermission.InviteUsersFromAD`, which no role holds by default. Southwind passes false because it uses no directory at all. |
| `AzureADClient` | `profilePhotos: "cached"` serves avatars from the local `CachedProfilePhoto` copy rather than calling Graph per render; inert for a user with no `externalId`, which is every locally seeded eastwind user. |
| `WindowsADClient` | `profilePhotos` off: the Azure provider already owns the avatar slot, and two providers would make every avatar try Azure first. |
| `ChartClient` → `ColorPaletteClient` → `UserChartClient` → `DashboardClient` → `ToolbarClient` | Each reads a registry the previous ones write into. Signum starts `ColorPaletteClient` from inside `ChartClient.start`; altea wires it here so every client is registered the same way. |
| `MailingClient` | After `UserQueriesClient` — the template editor's filter builder is altea-user-queries' shared `FilterBuilderEmbedded`. |
| `MailingReceptionClient` | After `MailingClient`: the extra tab is an `overrideView` on the `EntitySettings` `MailingClient` registers. |
| `OmniboxClient` → `MapClient` / `HelpClient` | `OmniboxClient.start` creates the provider registry the other two register into. `HelpClient` also needs `HtmlEditorClient` (its editors are the description editor). |
| `DynamicViewClient` | Load-bearing beyond its own editors: it installs a `ViewDispatcher` that prefers a view stored in the DATABASE over the compiled one, for every type. With no `DynamicView` rows saved nothing changes. |
| `WorkflowClient` | After `ToolbarClient` / `DynamicClient` — the configs it registers land in registries those own, and its designer views must be the last word on the workflow types. eastwind also declares `CaseActivityMixin` on `EmailMessageEntity`, so the mixin's read-only line goes on the email view after its `target`; Signum hard-codes that pair inside `WorkflowClient.start`, altea takes it per type. |
| `DiffLogClient` | LAST word on `OperationLogEntity`. |
| `TimeMachineClient` | After `DiffLogClient`, whose `DiffDocument` the page's data tab uses. |
| `TreeClient` | After `DashboardClient` / `UserQueriesClient`, whose registries it writes into. The tree TYPE is configured separately by `DepartmentsClient`. |
| `RestApiKeyClient.registerAuthenticator` | A separate call in Signum too, because a host may want the key ENTITY without letting `?apiKey=…` in the address bar log anyone in. eastwind opts in, as Southwind does. |
| `TourClient` | After `DashboardClient` / `UserQueriesClient`, whose extension points it pushes onto. |
| `MachineLearningClient` | After `ChartClient` — the `Full` result saver links to a Punchcard / Scatterplot chart whose script keys must already be registered. |
| `TranslationClient` | After `OmniboxClient`, whose special-action registry it pushes onto. |
| `ViewLogClient` | LAST of the log modules, so its quick link sits after the operation log's. |

## Bootstrap (`MainPublic.client.tsx`)

Southwind builds the route table and the React ROOT from scratch on every credential change, because
which routes EXIST depends on who is logged in — an anonymous visitor's router never receives the admin
routes, so `/find/Order` falls through to `NotFound`. That IS Signum's client-side authorization model:
gate by which routes exist, and let the server's role rules do the real enforcement.

Divergences from Southwind's `reload()`:

- **The metadata blob is loaded AFTER the routes are built**, where Signum's `reloadTypes()` comes first.
  `applyMetadata` stamps each DECLARED symbol's database id and runs each loaded module's
  `applyMetadataHooks`, so those modules must be imported before the blob is applied — and importing them
  is exactly what `startFull` does.
- `AppContext.newClientState()` is Signum's `clearAllSettings()`. Every client REGISTRATION lives in
  `AppContext.clientState`, so dropping it and re-running the bundle is the whole clear/re-register cycle.
  Signum needs a `clearSettingsActions` registry for this; altea needs one object.
- **The deployment MODE is fetched first, from the server.** `LegacyMode` lives in the SERVER's
  environment and `EntityOverrides` runs on both tiers and must reach the same answer — an `implementedBy`
  list decides what the editor offers as well as which tables exist. Duplicating it as a `VITE_` variable
  would let the two drift.
- `SessionSharing.setAppNameAndRequestSessionStorage` must run BEFORE the auth wiring (it namespaces the
  cross-tab logout signal) and BEFORE `reload` (whose `autoLogin` reads the token); it is awaited so the
  cross-tab storage round-trip finishes first.
- `AuthClient.registerUserTicketAuthenticator()` must precede `autoLogin`, which is what consults the
  authenticator chain. The DIRECTORY authenticators are registered before the first `reload` and awaited,
  because each asks the server for its configuration; both stand down silently when unconfigured. Windows
  integrated authentication is the exception — it cannot self-gate, so it needs `VITE_WINDOWS_AUTH`.
- `onLogin` rebuilds FIRST then navigates (the target is an admin route that does not exist until
  `startFull` has run); `onLogout` navigates FIRST then rebuilds (avoids a `NotFound` flash). Southwind
  does the same. `onLogin` looks for where to go back to in the router STATE first (what `NotFound`
  stashes when it bounces an anonymous deep link) and then the `?back=` parameter. The state is read
  AFTER the reload, because the rebuild replaces the router and the new one initialises its location from
  history — state included.
- The React root is unmounted and re-created because the router OBJECT is new, and `RouterProvider` does
  not accept a different router on a re-render. The `App` wrapper remounts the tree on `resetUI`
  (a metadata refetch, a switch-user) so components re-read the new role's data.
- `library.add(fas, far, fab)` — BRANDS too, which Southwind does not add although Signum declares the
  package: the two `["fab", …]` icons in the workspace (altea-markdown's cheat-sheet marker,
  altea-auth-windowsad's sign-in button) rendered as an empty span without it.
- `ErrorModal.register()` wires the global error / unhandled-rejection handlers. Without it an unhandled
  rejection — e.g. a failing `parseFindOptions` inside SearchControl's `useAPI` — is swallowed with only a
  console message, so the SearchModal renders empty instead of surfacing the error.
- `bootFailure.client.tsx` has no Signum counterpart — everything in `boot()` runs before React exists,
  so a throw there has no ErrorBoundary and no ErrorModal to land in. Two things it must do, both learned
  the hard way: render an ELEMENT and take the splash down explicitly (the splash is fixed, opaque and
  z-index 2000, and assigning `textContent` did not trip its observer — a failing `/api` call at boot
  showed a spinner that never stopped with the message invisible beneath it); and read the error WITHOUT
  assuming `Error`, since altea's ajax layer throws a `ServiceError` whose useful parts live on
  `httpError`.
- `VITE_PASSWORD_IS_USERNAME` is a DEV-only convenience (not in Signum): the login form drops its password
  field and sends the user name as the password, which the dev seed hashes as each user's password.
  `import.meta.env.DEV` is statically replaced by Vite, so it is dead code in a production build — and the
  request is the normal `/api/auth/login`, which the server validates as usual.

## `legacyMode` vs `Modules.xml`

These look alike and are not the same lever:

- **`legacyMode`** is a RUNTIME switch (`LegacyMode` env var) for pointing THIS application at a
  database a Signum application generated. Every gated module stays in the source and stands down at
  boot, so one build serves both. Each gated call is marked "not in Southwind".
- **`Modules.xml`** is a SCAFFOLD-time spec: it says how to REMOVE a module from a copy of eastwind
  entirely, for a new application built from it. Nothing reads it at runtime.

A module Southwind does not install appears in both — gated by `legacyMode` here, and listed as its own
`<Module>` in `Modules.xml`. That is not duplication: one answers "can this build read a Southwind
database", the other "does this new application want the module at all".

Because `Modules.xml` removes SPANS of source, the bootstrap files keep an explicit anchor on every
multi-line block: `//<ModuleName>` as a trailing comment on the block's closing line, so a
`<RemoveLine From="…" To="}//<ModuleName>"/>` has something stable to match. Southwind's `Starter.cs`
uses the same convention (`//Cache`, `//Dynamic`, `//Chatbot`, `//MCP`, `//ConfigureBigString`). **Do not
delete those markers** — they look like noise and are load-bearing.
