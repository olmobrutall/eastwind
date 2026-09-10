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
  altea-dynamic/      # define the app FROM the app: TYPES, expressions, validations, type conditions,
                      #   mixin connections and api endpoints (generated as TypeScript, compiled with the
                      #   quote-transformer and loaded), plus views interpreted from the DATABASE, CSS
                      #   overrides and SQL migrations (Signum.Dynamic, both halves — see below)
  altea-eval/         # EvalEmbedded<F>: a TypeScript script stored in the DATABASE, type-checked and run
                      #   at runtime (Signum.Eval, whose Roslyn becomes the TypeScript compiler)
  altea-help/         # in-app documentation: a page per type / package / query / appendix, its prose
                      #   AUTO-GENERATED from reflection and editable in place, plus search and a
                      #   zip import/export (Signum.Help)
  altea-html-editor/  # WYSIWYG rich text over Lexical + viewer + html→text (Signum.HtmlEditor)
  altea-isolation/    # multi-tenancy by ROW: an isolation per tenant, an ambient current isolation, and a
                      #   query filter + save rule per isolated table (Signum.Isolation). NOT wired into
                      #   eastwind — see the divergence bullet; its own test/ suite is the verification
  altea-files-azure/  # Azure Blob Storage file store (Signum.Files.AzureBlobs)
  altea-files-s3/     # S3 / MinIO file store (Signum.Files.S3)
  altea-mailing-exchange/ # sending through Exchange Web Services (Signum.Mailing.ExchangeWS)
  altea-mailing-microsoft-graph/ # sending through Graph + browsing a remote Outlook mailbox
                      #   (Signum.Mailing.MicrosoftGraph, incl. its RemoteEmails half)
  altea-mailing-pop3/ # receiving over POP3 (Signum.Mailing.Pop3)
  altea-markdown/     # a markdown editor line (text area + rendered preview + a syntax cheat sheet), the
                      #   "Markdown" query-column format rule, and markdown→text for the excel export
                      #   (Signum.Markdown)
  altea-machine-learning/ # train a model over a registered QUERY and predict with it: the predictor
                      #   definition, column codification, a TensorFlow.js neural network and the
                      #   interactive predict page (Signum.MachineLearning)
  altea-map/          # the schema map (a d3 force graph of tables + FKs, colourable by package / kind /
                      #   size / per-role access) and the operation map (one type's state machine)
                      #   — Signum.Map
  altea-office-template/ # docx/pptx/xlsx templating (Signum.Word) + the whole of Signum.Excel: the
                      #   plain export, the importer and the stored ExcelReport templates; hand-built
                      #   OOXML substrate
  altea-time-machine/ # browse / compare / restore the versions of a @systemVersioned row
                      #   (Signum.TimeMachine)
  altea-tour/         # guided in-app tours over driver.js, anchored to a type / dashboard / user query /
                      #   declared trigger (Signum.Tour)
  altea-translations/ # translating the app: the per-package translation XML files (code) and the
                      #   per-instance @translatable fields (data) — Signum.Translation, both halves
  altea-printing/     # a print QUEUE: a line per document, batched into packages a process prints through
                      #   an app-supplied hook, plus the panel and the file-reclaiming task (Signum.Printing)
  altea-rest/         # API-key authentication for an app's PUBLIC rest surface, plus a replayable log of
                      #   every request that reached it (Signum.Rest)
  altea-sms/          # SMS templates (per-culture text over a query / model), messages, and the send +
                      #   update-status process algorithms (Signum.SMS)
  altea-view-log/     # who viewed which entity, and which searches they ran, with the SQL each ran
                      #   (Signum.ViewLog)
  altea-tree/         # an entity whose rows form a FOREST: a depth-first route column, the tree page /
                      #   modal / dashboard part, and add-child / move / copy / delete (Signum.Tree)
  altea-whats-new/    # in-app RELEASE NOTES: a news item per release (one message per culture), the navbar
                      #   bullhorn, and a per-user read log (Signum.WhatsNew)
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
(`altea-auth/{data,client,server}/`). Pick ONE: a file inside a layer directory does not also take the suffix
— `server/EmailLogic.ts`, never `server/EmailLogic.server.ts`, which states it twice.
Either way the layer boundary holds: client never references server, and
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

- **`@part` is a DECORATOR, and a part is a CONTINUATION of its owner, never a root.** "Part" is by far
  the most-declared kind (120 of the 124 classes that name one) and the whole codebase already talks about
  "a `@part` row", so it is `@part` — bare, and with NO EntityData, where every other kind must be given
  one. A part is reached and saved through the entity that OWNS it, so its data is the owner's by
  construction (Signum's own rule for an MList table): `SchemaBuilder.include` passes it down as it
  recurses, and `complete()` then propagates it across the whole model, which is what catches a part
  reached through an `@implementedBy(() => [])` the APP widens — the owner's table was finished before
  the app named it, so nothing had included it with the owner in hand. A part NOTHING references falls
  back to `Master`, which is what Signum declares for both of the ownerless ones (HelpImage,
  UserTreePart). Sixty declarations used to restate the derived value; ONE of them differed from its
  owner and is now the owner's — `NeuralNetworkSettingsEntity` said Master where PredictorEntity is
  Transactional, as Signum's declaration also does. Nothing in altea reads the facet yet (it is
  Signum-parity metadata, used there by the sync and the schema map), so that is where to look first if a
  consumer appears. `@entity("Part")` is GONE too, not left beside it: `entity`'s `kind` excludes it and
  its `data` is mandatory. **The quote-transformer has to know the name**
  (`FIELD_INJECTING_DECORATORS`) or a part class gets no `@field` injection and no `registerType` and is
  simply absent from reflection — and a transformer change is invisible to tsc's up-to-date check, so
  this kind of edit needs **`tspc -b --force`** or an incremental build re-emits every part unregistered.
  - **A `@part` does not RE-ROOT a PropertyRoute — in an array or not.** Signum re-roots at every entity
    reference (`AddImp`) because a part is not an entity THERE: an `MList` element or an owned
    `EmbeddedEntity` is flattened into its owner's route, so `Songs/Name` and `ShipAddress.City` are
    routes of the owner. altea gives both a table and therefore a class, which made them look like
    references. The rule is the predicate `isPartType`, applied to every reference — the collection case
    is not special. `SharedPart` is EXCLUDED: several owners, so "continue the parent" has no single
    answer and re-rooting is the only unambiguous thing to do, which is what Signum's `EntityKind
    .SharedPart` is for.
  - **…so it may not ROOT one at all, and that is checked in the CONSTRUCTOR.**
    `Product.AdditionalInformation/Key` and `(Product_AdditionalInformation).Key` were two names for one
    member: a rule stored under one is invisible to a lookup made through the other, and a Signum
    database's row has no counterpart at all (eastwind's AuthRules.xml carried Southwind's two
    `AdditionalInformation/*` rules commented out for exactly that). The `PropertyRoute` constructor
    refuses a Root step on a part, so there is no way to end up HOLDING the second name — `root()` is not
    the only way in (`add`'s re-root branch builds one too), and a check each caller must remember to make
    is a check that gets forgotten.
    - **`PropertyRoute.rootStandalone(ctor)` is the one deliberate way past it**, for a part with NO owner
      in the picture, and it has exactly two consumers: the reflection blob's per-type LABEL dictionary
      (`memberPaths`, which hands back STRINGS so the root cannot escape) — `FieldInfo.niceToString()`
      reads it by (declaring type, member), so `AlbumEntity_Song.name` needs an entry under the SONG — and
      a part's OWN registered query (`sb.include(x).withQuery()` on a row type: @altea/altea-agent does it
      for a chat message's tool calls), whose columns are its own members and whose stored tokens are
      scoped by the query key. altea-playwright's `LineContainer.as(type)` is the third, and stores nothing.
    - `assertNotPartRoot()` remains what a STORAGE boundary asks, since a route can arrive from anywhere:
      `toPropertyRouteEntity` / `propertyRouteEntitySync` refuse one, and `PropertyRouteLogic.modelPaths` /
      the property-auth enumeration answer NOTHING for a part.
    - **the consumers that used to re-root at a part now continue the owner's route**, which is also where
      the rules are stored: EntityTable resolves its columns against the owner's element route, RenderEntity
      and FrameModal keep the route they were opened from, the token layer's `normalizePropertyRoute` and
      the synthetic `Id` token borrow the parent's, the SERIALIZER continues `sc.route` / `dc.route` (and
      keeps the owner's auth metadata, since a part is no more an IRootEntity than Signum's embedded is),
      and a multi-setter path MAY cross a part (Signum's `PropertyPart` intent, whose condition was wrong
      there). `TypeContext.root` / `cast` / `as` and FramePage — which have no parent route by construction
      — hand the context the bare TypeReference instead.
    - **`@implementedByAll` no longer offers a CAST to a part**, which brings that list back to Signum's:
      altea's mapped types include the rows standing in for MList tables, which are not types there.
    - **`data-property-path` is still the line's OWN member.** `TypeContext.propertyPath` used to be the
      whole `propertyString()` and read the same only because the UI re-rooted at every entity; it takes
      the last step now, so an order line's cell says `Product` as every other line does — which is the
      contract altea-playwright's per-step narrowing is built on.
    **An existing altea database needs `eastwind/terminal/migratePartRoutes.ts` BEFORE the sync** — the
    synchronizer sees every part-rooted row as REMOVED and the DELETE cascades to every consumer.
  - **A `@part` gets a `TypeEntity` ROW unless it IS a legacy MList table.** `typedTables` skips
    `table.legacyMode && table.isMListRow`, and that predicate (`mlistRowOwner`) is the whole of the
    question: a part reached through an owner's ARRAY is Signum's MList TABLE, which is not an entity
    there at all — so a Signum database has no row for one, and Signum's own synchronizer DELETES rows it
    does not recognise, which would have the two applications taking turns adding and removing them. A
    part reached through a single reference stands in for a Signum EMBEDDED, and one whose owner declares
    `@legacyTableName({ wasVirtualMList: true })` stands in for a real ENTITY: both get a row in either
    mode, because Signum has one for both. Nothing needs the missing id — an MList row is never the target
    of an `@implementedByAll`, and a property route is rooted at the OWNING entity.
  - **`includeArrayElements` gates the BARE element route, not the DESCENT into it** — Signum's
    `includeMListElements`, whose `GenerateEmbeddedProperties(itemRoute, …)` call sits outside the flag.
    altea had gated the whole descent, so the property-auth pack (false, as Signum's is) had never seen a
    single collection member. A row's BOOKKEEPING is skipped when descending — `id`, `ticks`, the
    `@backReference`, the `@rowOrder` — because Signum's element has none of them (its Parent and Order
    are table columns built with a NULL route).
  - **A ModelEntity may hold `@part` rows**, a field or a collection, with NO `@backReference`: it is
    never persisted, the codec recovers the nearest ENTITY ancestor (so a model yields no owner rather
    than dying on `slot.owner.toLite is not a function`), and the routes are the model's.
- **MLists are gone.** No `MList<T>` / `MListElement` wrapper. A collection is a **plain array** of `@part` row entities (or scalars on a row's `@valueField`). `@id` / `@order` / `@backReference` are markers, **not columns**.
  - **A collection may be declared INSIDE AN EMBEDDED, and its rows belong to the entity that holds it.**
    Signum does this freely (its own test model's `EmbeddedConfigEmbedded.Awards` is an `MList` on an
    `EmbeddedEntity`); altea used to refuse it, so every such collection was HOISTED onto the owning
    entity — which changes the table's name, and for a configuration held on an app's settings row
    changes its shape entirely: three `BaseADConfigurationEmbedded` subclasses had to become `Entity`
    (each with a table of its own) purely to have somewhere for `roleMapping` to point. An embedded is
    FLATTENED onto its owner's row, so it has no id and no `toLite()`; the row type's
    `@backReference` therefore names the ENTITY that holds the embedded, never the embedded — which
    `SchemaBuilder.complete()` now VERIFIES, walking each table's embedded fields and naming the route
    (`settings.tags`) when it refuses.
    - **the table is named from the ROUTE in legacy mode only.** Signum composes an MList table's name
      from the NameSequence accumulated down the property route (`GenerateTableNameCollection` is
      `table.Name.Name + "_" + name`), so a collection two members deep is
      `application_configuration_azure_ad_role_mapping`. Normal mode keeps altea's own rule — a
      `@part` row table is named after the ROW ENTITY — so no existing table moves;
      `mlistRowOwner` finds the collection through embeddeds and returns the whole member path,
      which also gives such a row Signum's other MList facets in legacy mode (no Ticks, a `ParentID`
      back reference, an element column named from the element TYPE).
    - **the walkers that were shallow are now one member deeper.** `forEachField` is deliberately
      shallow (own fields + mixins), so the saver's `wireOwnedChildren` and `deleteCollectionOrphans`
      both walked past an embedded's collection: nothing wired the back reference or the `@rowOrder`,
      and no orphan was ever swept. The orphan sweep is schema-driven now, which also fixed a latent
      gap — a MIXIN's collection was never swept either (`table.fields` has no mixin entry).
    - **clearing the embedded deletes the rows it held.** The embedded and its collection are one unit,
      as an owner and its MList table are in Signum, so `x.config = null` sweeps them (the snapshot
      still holds the id-list, which is what the sweep reads).
    - **the serializer recovers the nearest ENTITY ancestor.** A collection element omits its
      `@backReference` on the wire; the codec passed the IMMEDIATE container as the owner, so an
      element inside an embedded died on `slot.owner.toLite is not a function` — the failure
      altea-help's header already records for a `ModelEntity`. `applyFields` threads the entity down
      through each embedded instead.
    - **the LINQ binder correlates on the same owner id.** An embedded's sub-fields are bound off the
      owner's alias, so passing `ownerId` on is all an embedded's collection needs to be eager-loaded
      like any other (it was explicitly given up before — the comment said so).
    - **the delete cascade had the SAME shallow walk**, so an embedded's rows were left behind and the
      DELETE then failed on their foreign key. Fixed with the mixin gap beside it, as the orphan sweep was.
    - **a row type in a FRAMEWORK package names its owner through an `@implementedBy(() => [])` the
      app widens**, because it must not name an app type — the `ChangeLogViewLogEntity.user`
      accommodation. That is how the three DIRECTORY configurations reach eastwind's
      `ApplicationConfigurationEntity`. It resolves to exactly ONE implementation (a `@part` row is one
      table keyed by one back reference), which `validateEntityArray` enforces, and because there is
      then only one column it carries the FIELD's nullability rather than the polymorphic
      always-nullable default — so it comes out `NOT NULL`, as Signum's `ParentID` is. In legacy mode
      it IS `ParentID`: an MList table has no polymorphic parent in Signum, so the `_<Impl>` suffix
      that disambiguates an ordinary `@implementedBy` has nothing to disambiguate. Both the collection
      correlation and the delete cascade read that single column through one helper.
    - **STILL NOT POSSIBLE:** one row type backing TWO collections of the same type on one entity
      (`PersonEntity.maleFriends` / `.femaleFriends` → one `Person_Friendship`), inside embeddeds or
      not. A `@part` row is one TABLE keyed by one back reference, so two collections sharing it would
      read each other's rows — hence one row type per collection, which is also what Signum's per-route
      MList table gives.
    Pinned by `altea/test/server/schema/embeddedCollection.test.ts` (10 DB-free cases: the naming in
    both modes incl. a nested route, the refusal, the legacy MList facets, the save-cascade wiring, and
    the widened back reference in both modes) and `altea/test/server/orm/embeddedCollection.test.ts`
    (6 DB cases + the serializer round-trip). The framework's own fixture was moved BACK to Signum's
    shape — `ConfigEntity.awards` returned into `EmbeddedConfigEmbedded` — so **that suite's database
    needs regenerating** (`pnpm --filter @altea/altea gen:postgres`).
  - **It let the three DIRECTORY configurations become EMBEDDEDs, as they are in Signum.**
    `BaseADConfigurationEmbedded` and its three subclasses were `Entity` (a table each) purely to give
    `roleMapping` an owner to point at; they are now flattened onto the app's settings row, so
    `azure_ad_*` / `open_id_*` / `windows_ad_*` are columns on `application_configuration` and the
    rows live in `application_configuration_<directory>_role_mapping` — Signum's names, matched by a
    Southwind sync rather than offered as a rename of an unrelated table. Signum's `[PreserveOrder]` on
    the MList is mirrored too (it was declined before, and the column is part of the table a Signum
    database already has). What remains on the AzureAD half of a Southwind diff is three lines, all
    older decisions: the `auth` schema every altea-auth table lives in, and `applicationID` /
    `directoryID` being `string` rather than `Guid`. **An existing altea database needs a `sync`**
    (three tables drop, ~30 columns move onto `application_configuration`); eastwind's dev database
    held no rows in any of them. Pinned end to end by `eastwind/terminal/probeEmbeddedCollection.ts`
    (25 checks), which is where the cross-package back reference is exercised against a real database.
  - **`SmtpNetworkDeliveryEmbedded` went back too, and it needed no widening** — its owner
    (`SmtpEmailServiceEntity`) is in the same package, so the row type names it directly. Its columns are
    `network_*` on `mailing.smtp_email_service` and its rows are
    `smtp_email_service_network_client_certification_files`, both Signum's exactly: a Southwind sync now
    scripts NOTHING for the whole SMTP sender configuration. Signum does NOT mark that MList
    `[PreserveOrder]`, so the `@rowOrder` altea had added is gone with it. **An existing altea database
    needs `eastwind/terminal/migrateSmtpNetwork.ts` BEFORE the sync**: the sync would add the `network_*`
    columns and drop the table in one script, losing every configured host and credential.
    @altea/altea-mailing-pop3's `ClientCertificationFiles` carried the same spurious `@rowOrder` and
    lost it too — its collection hangs off an ENTITY, so it needed nothing else.
  - **An EmailTemplate's `From` is an EMBEDDED, its Recipients stay rows, and the shared BASE is what
    gives way.** Signum declares an abstract `EmailTemplateAddressEmbedded` — the four members saying
    WHERE an address comes from — and derives `EmailTemplateFromEmbedded` (a single nullable embedded,
    FLATTENED onto `email_template` as `From_WhenNone_ID`, …) and `EmailTemplateRecipientEmbedded`
    (the ELEMENT of an MList, whose table inlines the members with no prefix). altea had made both
    `@part` ENTITY rows, which gave the template a `FromID` foreign key to a side table Signum has no
    counterpart for.
    The From is an embedded now; the RECIPIENT stays an entity row, because a collection here is `@part`
    rows and its columns are then named from the row's own fields — which is the same unprefixed set. So
    the two land on opposite sides of the entity/embedded divide and **the base cannot be shared**: an
    Entity cannot derive from an EmbeddedEntity. Keeping it would mean making the row a WRAPPER around an
    element embedded (`row.element.emailAddress`) — the `@valueField` shape UserChart's columns use —
    which buys the shared declaration at the price of an indirection in every reader. The four members are
    written out on each instead: **the duplication is the cheaper half of that trade**, and the database is
    identical either way. The row also loses a `@rowOrder` altea had invented: Signum marks that MList
    `[NoRepeatValidator, BindParent]` and NOT `[PreserveOrder]`. Both tables now script NOTHING against
    a Signum database: 373 → 347 statements.
    **An existing altea database needs `eastwind/terminal/migrateEmailTemplateAddress.ts` BEFORE the
    sync** — otherwise the sync adds the flattened columns, drops `from_id` and DROPS the From table in
    one script, so every template loses who it is sent FROM, leaving templates that look configured and
    cannot send. The recipients need nothing: their row keeps its column names, and only drops an `Order`
    column nothing reads.
  - **A per-culture MESSAGE row names its culture `cultureInfo`, and only the MASTER template's is
    ordered.** Signum calls the member `CultureInfo` on all three message embeddeds (EmailTemplate,
    EmailMasterTemplate, SMSTemplate) — the member IS the column, so `CultureInfo_ID` — where altea had
    shortened it to `culture`. And `[PreserveOrder]` is on the MASTER template's MList ALONE: the other
    two are `[BindParent]` only, so their tables have no Order column and altea's `@rowOrder` invented
    one. All three tables now script NOTHING: 347 → 322 statements. **An existing altea database needs a
    `sync`, answering the rename prompt** (`culture_id` → `culture_info_id`) — it is a pure rename, so
    that keeps every message's culture; a headless run would drop and re-add the column instead.
  - **A collection ELEMENT is an entity, so it is not called `*Embedded`.** Nine row types were named for
    the Signum EMBEDDED they port (`RoleMappingEmbedded`, `CssStepEmbedded`, `QueryStringValueEmbedded`,
    `WhatsNewMessageEmbedded`, `ClientCertificationFileEmbedded`) or for the embedded that used to own
    them (`AzureADConfigurationEmbedded_RoleMapping`); they are `RoleMappingEntity`, `CssStepEntity`,
    `AzureADRoleMappingEntity` and so on. The name is reflection IDENTITY, so this moves each table in
    NORMAL mode (`tour.css_step_embedded` → `tour.css_step`) and requires a `sync`; legacy mode names an
    MList table from the route, so a Signum database sees nothing. It also repairs translations: a
    package's XML keys a type by its CLASS name, and three files carried Signum's
    `ClientCertificationFileEmbedded` for a class altea had called
    `SmtpNetworkDeliveryEmbedded_ClientCertificationFile` — so those entries had never landed. Comments
    that CITE the C# source keep Signum's spelling.
- **Do NOT initialize entity fields to a type's default.** `strictPropertyInitialization` is **off** (`altea/altea/presets/base.json`), so a field needs no initializer to compile — and adding one just to silence an imagined warning is noise. Write `@rowOrder order: int;`, `token: QueryTokenEmbedded | null;`, `orderType: OrderTypeEnum;`, `parts: DashboardEntity_Part[];` — **not** `= toInt(0)` / `= null` / `= OrderTypeEnum.Ascending` / `= []`. Specifically:
  - a reflected `T[]` collection is seeded with `[]` by the quote-transformer, so `= []` is always redundant;
  - `@rowOrder` / `@backReference` are filled by the save cascade (and exempt from the implicit NotNull);
  - `= null` on a nullable field says nothing `undefined` doesn't.
  **Keep only the initializers Signum itself declares** — a real non-default business value (`port = 25`, `editableMessage = true`, `chunkSizeSendingEmails = 100`, `creationDate = Clock.now`). Mirroring Signum is the rule; restating a zero value is not.
- **QueryDescription is gone.** Signum shipped a serialized query-metadata DTO (`QueryDescription` / `ColumnDescription` / `QueryTokenWithoutParent`) to the client; altea resolves query tokens from the **registered entity metadata** instead (`entities/dynamicQuery/tokens/*`), so token trees are built client-side (`Finder.getQueryRoot`). There is no DTO, no `fetchQueryDescription`, and no `/api/query/description` route — the only remaining references are comments documenting the divergence.
- **A query TOKEN is PascalCase and ROOTLESS, and it resolves case-insensitively.** Signum's token key is a C# property name, so `Entity.ShipAddress.City`; altea's is a TypeScript field name, and used to be the key verbatim — `shipAddress.city`. Rootless is a real divergence and stays (altea's query root IS the entity, where Signum's root token is its `Entity` COLUMN); the CASING was not a divergence at all but an inconsistency, because `QueryTokenString.tokenSequence` — what `Type.token(a => a.shipName)`, every `defaultColumns` entry and every `findOptions` builder go through — has always PascalCased. So a token the typed builder BUILT could be resolved by the client (whose `Finder.TokenCompleter` keys its cache by `fullKey().toLowerCase()`) and not by the server (whose `QueryLogic.getToken` was an exact Map lookup) — which is why altea-workflow's Inbox had to spell its tokens as camelCase literals. One spelling now, Signum's, so a stored token is the same string in both frameworks.
  - it is the KEY that changed, on the three tokens that derive one from a member: `EntityPropertyToken` (the field), `ObjectPropertyToken` (`Length`, `Year`, `DayOfWeek` — Signum's PropertyInfo names, not the binder members `length` / `year`, which the token still carries separately) and a registered EXPRESSION whose key is derived from the lambda's tail member (`deriveKeyFromQuoted`). An explicit `{ key }` at registration is honoured verbatim, and every one in the workspace was already PascalCase. Every other token key (`ToString`, `HasValue`, `Count`, `Element`, `Any`, `(Album)`, `[QuickLinks]`) was Signum's already.
  - **`QueryToken.subToken` falls back to a CASE-INSENSITIVE match**, so nothing stored has to be migrated: every token altea itself wrote before this, and every hand-written camelCase literal in the workspace, still resolves. An exact hit always wins, so two keys differing only in case (a `Notes` expression beside a `notes` field) stay distinguishable. The client resolved this way already; the server's exact-only lookup was the odd half, and a token that resolves in the browser but not on the server is the worst of both.
  - **LEGACY MODE drops a leading `Entity.`** (`stripLegacyRootPrefix`, applied by `QueryLogic.getToken` and by the client's `TokenCompleter`): a Signum-stored `Entity.ShipName` is altea's `ShipName`. One direction only — READING — because a token altea writes back must stay altea's, or a Signum deployment reading the same row would find a column it cannot resolve. And only when nothing ANSWERS to `Entity`: a query named by a row MODEL has a real `Entity` member (`rowEntityToken` reads it), and that one wins. It is the mirror image of the fallback Signum's own `QueryTokenSynchronizer` has, which ADDS the prefix.
  - **the `…Start` date tokens are ported** (`DatePartStartToken`, Signum's DateTimeSpecialTokens):
    `QuarterStart` / `MonthStart` / `WeekStart` on any date, plus `HourStart` / `MinuteStart` /
    `SecondStart` on a PlainDateTime. It is what a per-month chart axis groups by, which `Month` alone
    cannot be — that is the number 9, so two Septembers a year apart share a bucket and the axis has no
    chronology; Southwind's six month-axis charts are all built on `OrderDate.MonthStart`, and eastwind's
    seed had been substituting `Month` for it. The SQL half already existed (the nominator lowers
    `monthStart()` / `truncHours()` to `DATETRUNC` / `date_trunc`), so this is the token, not the
    translation — and the same call evaluates in memory. Signum's STEPPED variants (`Every 12 Hours`) are
    not ported, as the sibling numeric `StepTokens` are not.
  - **a POLYMORPHIC reference offers CASTING and nothing else of the model, as in Signum** — one
    `(Company)` / `(Person)` AsType token per implementation, and `HasValue`. A member of the DECLARED
    type is not offered even when that type is an abstract base every implementation derives from:
    reaching one means either casting (`Customer.(Company).Address`) or REGISTERING it as an expression
    on that base, which `cachedSubTokensOverride` then merges in off the DECLARED type — Signum's
    `GetExtensionsTokens` resolving on `parent.Type.CleanType()`, and altea's `getExtensionsTokens`
    walking `entityCtorOf(parent.type)`'s prototype chain. That is how Southwind exposes the three
    members `CustomerEntity` declares (`QueryLogic.Expressions.Register((CustomerEntity c) => c.Address)`
    …`Phone` …`Fax`, CustomersLogic.cs) and therefore how its stored `Customer.Address.Country` chart
    resolves; eastwind's `CustomersLogic` registers the same three, which is the whole of what that
    chart needed.
    - **offering them unregistered was tried and REVERTED.** It reads as a convenience — the member is
      declared on a base every implementation has, and both binders translate it perfectly well
      (`BindMemberAccess` / `bindImplementedByMember` → `DispatchIb` / `dispatchIb`, a CASE over the
      implementations with one LEFT JOIN each) — but it makes the FRAMEWORK decide which of a base's
      members are worth a column in every application, where Signum leaves that to the app that knows,
      and the mechanism for saying yes already exists on both sides. Signum's `ForcePropertyRoute` has
      no counterpart: altea derives the route from the expression's own Meta.
    - **`HasValue` IS a fix**: Signum's polymorphic branch ends in `.AndHasValue(this)` and altea's had
      dropped it. `Id` and `ToString` are NOT offered there by either framework (they belong to the
      single-implementation branch), and altea still lacks the `EntityTypeToken` Signum also puts here —
      a `phase3c` TODO, so the divergence that remains runs the other way.
    - the framework fixture's `AwardNominationEntity.award` was widened to `Lite<Entity>` where Signum
      declares `Lite<AwardEntity>`; it is back on the abstract base, which is what lets the test register
      an expression on it. The column is named per implementation either way, so no database moves.
- **`TypeReference` is the ONE shared value-type descriptor.** `FieldInfo extends TypeReference`; `QueryToken.type` / `PropertyRoute.type` return it. Signum's `RuntimeType` is **server-only** (lives in `server/logic`). Read type facets off it: `.typeName`, `.array`, `.lite`, `.kind`, `.getEnum()`, `.typeInfos()`.
- **No compat accessors.** Use the real model: `entity.constructor` (not `.Type`), `lite.entityType` (a ctor, not a string), `entity.isDirty()` (snapshot-based, not `.modified`).
- **`Type<T>` is the ONE entity-type handle, and it is a constructor** (Signum's `GenericType` is gone; `EnumEntity.typeFor` → a bound ctor). It is `abstract new (...args: any[]) => T`, so an ABSTRACT base (`CustomerEntity`, `AwardEntity`) is a valid handle — an operation or a rule may be attached to one and inherited by its implementations. There used to be a second, abstract-tolerant `EntityType<T>` beside it; two handles for one concept meant every signature had to pick a side, so they are merged. The few places that INSTANTIATE narrow explicitly — `newInstance(type)` (the Retriever building a row, the serializer, the enum-table synchronizer) — and `Entity.create`'s `this` stays `new () => T`, because a factory cannot be abstract-tolerant.
- **UI Lines read their type from `ctx.memberType`**, not an explicit `type={…}` prop. `AutoLine` dispatches to the right editor (text/number/date/enum/entity picker) from it — so many of Signum's parallel rules collapse into one.
- **Dates: luxon → `Temporal`** (`PlainDate` / `PlainDateTime` / `PlainTime` / `Duration`).
- **Culture: a `CultureInfoEntity` table like Signum's, but the user's pick is a request HEADER, not a cookie.** `CultureInfoEntity` (`data/cultureInfoEntity` + `server/cultureInfoLogic`) is the application's supported-culture table, and it is what every persisted culture REFERENCES rather than a free-text tag: an email / Office template's `culture` (`Lite<CultureInfoEntity>`, as in Signum) and @altea/altea-email's / @altea/altea-sms's `defaultCulture` (a full reference, as in Signum). **An existing altea database needs `eastwind/terminal/migrateDefaultCulture.ts` BEFORE the sync** — the two configuration columns were locale strings, and the sync adds the NOT NULL FK and drops the varchar in one script, so the settings row would come back pointing at no culture at all. `nativeName`/`englishName` come from `Intl.DisplayNames` where Signum uses .NET `CultureInfo`; a lookup falls back from a specific culture to its language ("en-US" → "en"). Where altea diverges:
  - the user's CHOICE lives in the BROWSER (`CultureClient`, localStorage) — Signum stores it server-side per user — and rides on every call as a bare `Accept-Language` tag, which `webApi` turns into a per-request `CultureInfo.withCultures` scope (Signum's ASP.NET request localization). Without that scope every SERVER-resolved label — a registered expression's niceName, validation and exception messages — answers in the process default no matter who asked, and a per-culture CACHE keyed on `currentCulture()` serves whichever language warmed it first to everyone.
  - switching culture RELOADS the page. Signum re-fetches its types and soft-resets, because all its labels are client-resolved; altea has server-resolved labels baked into already-fetched responses, which a soft `resetUI()` leaves stale.
  - Translation files live in EACH PACKAGE's own `translations/` directory (`altea/altea-workflow/translations/Altea.Workflow.es.xml`), not in one per-app folder as in Signum — a module's translations travel with the module, so any application that installs it gets them for free. At boot `loadAppTranslations` walks the app's dependency graph (through packages that depend on `@altea/altea`), loads each module's directory in package-name order, and loads the app's own `<appRoot>/translations` LAST so an app file wins a key collision. A Signum module renamed in altea (Word* → Office*) needs its ported XML's Type/Member NAMES remapped, or none of it lands.
- **`PropertyRouteEntity` EXISTS — the routes table five modules point at.** Signum's
  `basics.PropertyRoute` (Signum/Basics/PropertyRouteEntity.cs + PropertyRouteLogic.cs) is one row per
  property route, `(rootType, path)` where the path is a `propertyString()`; it is a NORMALIZATION, because
  five things need to name a route and each stores an FK here rather than repeating the pair — a property
  authorization rule (`auth.rule_property.resource_id`), a property's help
  (`help.type_help__property.property_id`), a tour's css step (`tour.css_step.property_id`), a dynamic
  validation's sub-entity (`dynamic.dynamic_validation.sub_entity_id`) and a translated instance
  (`translation.translated_instance.property_route_id`). altea originally declined the table and had each of
  those five store the route INLINE. That reads as the simpler model right up to the moment a database has
  to line up with a Signum one: `basics.property_route` then has no counterpart, so a sync offers to RENAME
  it into whatever unmatched table sorts nearest by string distance (a real run offered
  `basics.tour_trigger`), and all five consumer tables diverge by a column. All six now match Signum column
  for column — a Southwind sync scripts NOTHING for any of them.
  - **the rows are NOT seeded**, exactly as in Signum: no `schema.generating` hook, and `createNew` is
    undefined on BOTH levels of the sync. A row is created lazily by `toPropertyRouteEntity` when something
    first needs to point at that route, and saved as part of that consumer's graph — so a fresh database has
    an empty table and a Signum database keeps every row it has. Seeding instead would mean a row for every
    property of every type, tens of thousands of them, almost none ever referenced. The sync only REMOVES
    routes that no longer exist and REWRITES paths that were renamed (which is what keeps every stored FK
    pointing at the right route through a member rename), and a type's removal takes its routes with it
    through `EntityEvents<TypeEntity>.preDeleteSqlSync`.
  - **it forced a core seam: `registerAfterDeserialization`** (`data/serializer`), Signum's
    `WebEntityJsonConverterFactory.AfterDeserilization`. A route is built CLIENT-side (the tour editor, the
    validation designer), where the row's id is unknowable, so it arrives id-less and would INSERT a
    duplicate; the handler points it at the row that already exists and leaves it new when there is none,
    which is what makes the table demand-populated. It runs on the NEW-entity branch only, where Signum runs
    it for every entity — an id-carrying payload has nothing to resolve. Because the serializer is
    SYNCHRONOUS while a ResetLazy is not, the lazy is mirrored into a sync snapshot (the `GlobalsLogic.warmUp`
    pattern), and the refresh on save is AWAITED — fire-and-forget there lets a second POST of the same route
    hit the unique index.
  - **the caches key by STRING, never by an entity.** Signum keys `Properties` by `TypeEntity` and
    `PropertiesFromLite` by `Lite<PropertyRouteEntity>`, which works because an ambient EntityCache hands
    back one instance per row; altea gives each query its own Retriever (the accommodation altea-workflow's
    `keyOf` documents), so it is `cleanName` and the lite's `key()`. Same reason `PropertyAuthLogic`'s
    runtime caches stay keyed by (rootType id, path) even though the STORAGE is now a row.
  - **`should` is built from the MODEL**, not from Signum's `TypeLogic.TryEntityToType(rep)`: nothing is
    ever inserted, so the diff needs only (cleanName, path) pairs and never a TypeEntity id — which makes it
    tolerant of a type with no persisted row yet by construction rather than by a tolerant lookup.
  - **`extraSyncRoutes` FAKES the routes altea's model cannot name, and NEW here** (Signum needs no
    counterpart, having no second framework to line its routes up with). This table is the one place a
    MODELLING difference turns into DATA LOSS: a route altea cannot generate is offered as a rename of
    whatever sorts nearest by string distance and then DROPPED, taking every consumer row with it through
    the cascade above. Because nothing is ever inserted, an entry here can only ever PRESERVE a row — it
    can never create one, which is what makes the seam safe to over-supply. An ARRAY, as
    `simplifyDiffTables` is, asked per mapped ENTITY type; it feeds `PropertyRouteLogic.modelPaths`, which
    is what both the synchronizer and `generateProperties` now go through. NORMAL mode registers nothing:
    there the database is one altea generated, so it holds no route the model cannot name, and faking one
    could only hide a genuine removal.
    - **the built-in handler reads `@legacyPropertyRoute`**, the third member of the `@legacyTableName` /
      `@legacyColumnName` family and the one about a ROUTE rather than a physical name: *this method was
      ported from a C# property*. Signum writes such a member as a computed PROPERTY
      (`[AutoExpressionField] public decimal ValueInStock => As.Expression(() => unitPrice * unitsInStock)`)
      and `GenerateRoutes` walks `PublicInstancePropertiesInOrder`, so it is an ordinary route with an
      ordinary row — a Southwind database has an `auth.rule_property` on `Product.ValueInStock`. altea's
      entity model has no property getters, so the same member is a METHOD and route generation walks
      reflected FIELDS: `@quoted` stamps only `__quoted` onto the function and registers nothing on the
      TypeInfo, so the route is invisible. `reflectionServer.ts` records the same gap for the LABEL half
      and works around it from the translation file.
    - **DECLARED, never derived.** Whether the C# original was a property or an EXTENSION METHOD is a fact
      about the PORT, and Signum has no route for an extension method (altea-tree's `descendants`,
      altea-printing's `lines`, `entityNotes`) — so inferring it from the shape of the TypeScript would be
      guessing at the C# from its translation. A first attempt did exactly that, deriving the set from
      "`@quoted`, zero-arg, non-enumerable, not `toString`"; it happened to land on the right members here,
      but it also invented `Customer.SMSOwnerData` and `ApplicationConfiguration.IsActive`, which Southwind
      has no property for. A member that needs a route says so, and one that says nothing gets nothing.
    - **the path is spelled by `storedMemberName`** — the `PropertyRoute.storedMember` rule made public, so
      a faked path and a real one cannot disagree about PascalCasing — unless the declaration names the
      Signum spelling outright: `@legacyPropertyRoute("Duration")`, for a member altea deliberately renamed
      (`durationSeconds` / `durationMilliseconds` say what the unit is; only the database still cares that
      Signum called the property `Duration`). Inherited, because a property on an abstract base is a route
      of every type deriving from it, as in Signum. 17 routes over 10 types, each verified against its C#
      declaration: `Product.ValueInStock`, `Order.TotalPrice`, `OrderLine.SubTotalPrice`, Alert's four,
      CaseActivity's four, `CultureInfo.IsNeutral`, ResetPasswordRequest's two, and the three `Duration`s.
    - what this does NOT do is give altea the route: it is not in `PropertyRoute.generateRoutes`, so the
      property-auth grid does not list it and a rule on it gates nothing here — the member is not
      serialized, so there is nothing to gate. The row is preserved for the DATABASE's sake, and for the
      Signum deployment that may still be reading it. Only the type's OWN members: an expression on an
      EMBEDDED would be a dotted route, which no case needs yet.
  - `propertyRouteEntitySync` is the sync counterpart the XML importers need (`fromXml` cannot await), and
    it VALIDATES the path where Signum's `IFromXmlContext.GetPropertyRoute` scans generated routes — so a
    file naming a route that does not exist says which file is wrong.
  - `PropertyRouteProductionCleanup` is not ported: it exists for databases whose migrations only fixed the
    routes known in dev, and altea's answer to an unparseable row is the synchronizer that removes it.
  - **altea-dynamic gains a cascade Signum lacks.** Signum registers the PropertyRouteEntity
    `PreDeleteSqlSync` for Tour, Help and TranslatedInstance but not for DynamicValidation, so a sync that
    removes a route a validation points at fails on `sub_entity_id`'s foreign key. Fixed rather than mirrored.
  - `PropertyRouteCombo` moved out of altea-tour into `altea/client/Components`, where Signum keeps it, once
    the validation designer wanted it too — and it gained Signum's `routes` prop (which restricts the
    designer to mixins and non-collection embeddeds).
  - **an existing ALTEA database needs a DATA migration, not just a `sync`.** The sync would add each new FK
    column with a default of 0 and drop the old ones in the same script, losing every row's route and then
    failing on the new foreign key. `eastwind/terminal/migratePropertyRoutes.ts` does the conversion first
    (idempotent, one transaction): it creates the table, inserts a route per distinct (rootType, path) each
    consumer names — deriving the root type from the owner where the table did not store one — and points
    each row at its route; then the ordinary `sync` has only the old columns left to drop. A SIGNUM database
    needs none of it, which is the whole reason the type was ported. Verified on eastwind's dev database:
    16 property rules and 1 dynamic validation converted with nothing lost.
  Also aligned while in these tables: the four auth rule unique indexes now use Signum's member order
  `(resource, role)` instead of `(role, resource)` — eight lines of DDL churn a Southwind sync no longer
  emits. Pinned by `eastwind/terminal/probePropertyRoute.ts` (42 checks: the six tables' shape, that
  resolution is idempotent rather than duplicating, that the serializer hook snaps a client-built route onto
  the persisted row and leaves an unknown one new, that every consumer's delete cascade is registered, and
  each rule the expression-route seam turns on — including that normal mode adds nothing).
- **A user-asset COLLECTION row is identified by a uuid, and that id is what the XML matches on.** Signum
  declares nine of those collections `[PrimaryKey(typeof(Guid))]` and says why in a comment — *"the row id
  identifies the element in the XML"* — writes it per row on export (`SelectWithRowId`) and matches rows BY
  it on import rather than by POSITION (`SynchronizeRowIds`). Both halves are
  `altea-user-assets/server/UserAssetsImportExport`'s `syncRows` / `rowGuid`; the SelectWithRowId half is
  trivial here, because altea's collection element IS an entity with its own primary key. The nine:
  UserQuery filters + columns, UserChart filters + columns, Dashboard parts, both Toolbar element tables,
  and the EmailTemplate / OfficeTemplate filters — plus four scheduler ENTITIES Signum also gives a Guid PK
  (HolidayCalendar and the three ScheduleRule types).
  - **matching by position is not a smaller version of this, it is wrong**: re-importing an UNCHANGED asset
    rewrote every row, REORDERING one rewrote every row after the first move, and anything keyed to a row
    (a per-instance translation, whose key includes the row's own lite) was orphaned by the re-import.
  - Signum's back-compat is kept: a file with NO Guid on any element still imports by position, so an older
    export is not reported as a change; a file where only SOME rows carry one is refused rather than
    half-applied. The sync callback also receives the element's INDEX, for state that depends on position
    rather than on the XML.
  - **three of the nine carried a redundant `guid varchar` column** — a dashboard's parts and both toolbar
    element tables — altea's workaround for the row id being an int, which their own comments said so. It is
    gone, the primary key IS that guid, and Signum's tables have no such column either. **An existing altea
    database must promote the guid INTO the primary key before the sync**
    (`eastwind/terminal/migrateRowGuids.ts`), or the ordinary int→uuid migration assigns fresh ids and then
    drops the column, silently breaking every reference: an exported dashboard/toolbar XML names a
    part/element by it, and a tour's "DashboardPart" css step stores it as a plain string with no FK to
    cascade. The other six had an int id and nothing to preserve, so they get fresh uuids — safe only
    because nothing outside the row names those ids, which is worth re-checking on a database that has
    TranslatedInstance rows.
  - it retired a latent bug: the tour editor offered `String(part.id)` — the INT pk — as the DashboardPart
    key, while the DOM attribute a step has to match is the part's guid, so such a step could never resolve.
    The two are now the same value. `partContentKey` also yields UNDEFINED for an unsaved part instead of
    the string `"undefined"` (Signum's `rowId?.toString()`), so the attribute is omitted while there is
    nothing to target.
  - **a generated uuid key is TIME-ORDERED, and which generator says so follows the SERVER.** Signum
    moved its Guid PK default to `uuidv7()` and altea follows: a v7 uuid carries its timestamp in the
    high bits, so inserts land at the end of the index instead of scattering across it the way a random
    v4 (`gen_random_uuid()`, what altea emitted before) does. `guidKeyDefault` is Signum's
    `PrimaryKeyAttribute.IdentityBehaviour` setter plus the fallback in `DbTypeAttribute.GetDefault`:
    `uuidv7()` is NATIVE from PostgreSQL 18, and an older server drops back to `uuid_generate_v1()` —
    Signum's previous default, from the uuid-ossp EXTENSION, which is why it is not the first choice. The
    gate is `Connector.supportsUuidV7` (Signum's same member), false on the base — the SQL Server answer,
    which keeps Signum's `NEWID()` and reaches `NEWSEQUENTIALID()` through altea's own `uuid7` key type.
    An UNKNOWN version reads as modern, exactly as Signum's null version does.
  - **that detection is an explicit async step**, `Connector.detectServerCapabilities()`, which the host
    awaits right after building the connector and BEFORE the schema is built: Signum detects the version
    in its connector's CONSTRUCTOR and altea has no synchronous database access. A no-op on the base, so
    no caller needs an instanceof or a static import of a connector it may not be using, and skipping it
    is safe (an unprobed capability reads as modern). An existing PostgreSQL 18 database is upgraded by
    the next sync — one `SET DEFAULT` per uuid table, changing no stored value; one on an older server
    keeps v1 because the model asks for v1 there, so neither churns.
  Pinned by `eastwind/terminal/probeRowGuids.ts` (55 checks: the thirteen primary keys and their generator, the three dropped
  guid columns, each matching rule including the two refusals, and an end-to-end export + re-import of a
  real UserQuery that keeps every filter and column row id). Full ledger:
  **[altea/docs/port/UserAssets.md](altea/docs/port/UserAssets.md)**.
- **The CHANGE LOG is source, not data — and it is per MODULE, which is what makes it interesting.**
  Signum's Basics/ChangeLog.cs + ChangeLogLogic + the React ChangeLogClient/ChangeLogViewer: a navbar
  button showing what changed in each deployment, badged with how many the user has not read. The
  ENTRIES are a `Changelog.ts` per module — a date mapped to what changed on it, registered with one
  line from that module's client `start` — so publishing one needs no migration and no row; the only
  stored part is ONE row per user (`basics.change_log_view_log`) recording when they last looked.
  - **not to be confused with @altea/altea-whats-new**, which looks similar and answers a different
    question: WhatsNew is CONTENT an author writes in the app, per culture, published on a date, for END
    USERS. The change log is the DEVELOPERS' list, compiled into the client.
  - **the MERGE is the one non-trivial part, and the two `Update` forms differ.** A module dates its
    entries by when they were IMPLEMENTED, not when the app carrying them shipped — so the app's own
    changelog carries `Update <Module>` lines and each is REPLACED by that module's earlier entries. A
    bare `Update <Module>` stamps them with the APP's deploy date; `Update <Module> to <date>` stamps
    them with the date NAMED ("we took the module as of then", not "a user saw it then"). A module name
    covers its sub-modules, so one line pulls in a family, and anything no line claimed falls to the
    newest deployment rather than being dropped. That is Signum's behaviour exactly; it lives in its own
    `client/Basics/changeLogMerge` module because ChangeLogClient imports the ajax layer (which touches
    `document` at load) and the algorithm is worth unit-testing headless — Signum keeps them together
    and tests neither. Pinned by `altea/test/client/changeLog.test.ts` (8 cases).
  - **Signum's `VersionChangedAlert` is NOT ported**, so neither is the `VersionInfo` /
    `VersionInfoTooltip` pair the viewer hangs off there — in Signum this component IS the version-info
    navbar item. altea has no build/version surface, so the button stands alone and renders nothing
    without a user (there is no per-user read state to badge then).
  - luxon is unnecessary: every date use is a comparison or a group key and ISO dates compare correctly
    as strings (Signum imports luxon here and then compares `implDate < date` as strings anyway); the
    viewer's own comparison goes through `Temporal.PlainDateTime.compare`.
  - **both routes tolerate an ANONYMOUS caller** — null, and a no-op — rather than throwing on a null
    user. Signum reads `UserHolder.Current.User` unguarded, which is safe there only because its
    controller sits behind global authentication; altea's login screen is served by the same client and
    the navbar renders before anyone is logged in.
  - `start` takes no `routes` (Signum's signature has one and never uses it), and
    `ChangeLogViewLogEntity.user` declares no implementations so core needn't reference altea-auth — the
    app widens it, the accommodation `VisualTipConsumedEntity.user` already makes. `basics.change_log_view_log`
    needs a `sync` and matches Signum's table column for column, bar the app-wide nullable-implementedBy
    divergence (seven tables share it). Pinned by `eastwind/terminal/probeChangeLog.ts` (19 checks).
- **`SemiSymbol` EXISTS** (`data/semiSymbol` + `server/semiSymbolLogic`), as Signum's sibling of `Symbol`: a row that may be DECLARED in code (it gets a `key`, like a Symbol) or created by a USER at runtime (only a `name`). That is why its key is NULLABLE and why it derives from `Entity` rather than `Symbol` — a SemiSymbol table is user-writable (`@entity("String")`, its own Save operation), so it is not "seeded". The one rule that matters is in its synchronizer: only rows WITH a key take part in the diff (Signum's `current.Where(c => c.Key.HasText())`), so a row a user created is never deleted by a sync. `AlertTypeSymbol`, `AgentSymbol` and `NoteTypeSymbol` are SemiSymbols; everything else stays a `Symbol`. The quote-transformer recognises BOTH roots, so `init()` works on either.
  **`SymbolLogic.start` registers the type's QUERY**, as Signum's `SymbolLogic<T>.Start` does (`sb.Include<T>().WithQuery(…)`) — altea included the table and left the query to each module, so a symbol type nobody thought to add `withQuery()` for had no `basics.query` row: `Operation`, `Permission`, `TypeCondition`, `ChartScript`, `TourTrigger` and `VisualTip`, all of which a Signum database has, and whose search page is how a symbol is looked up at all. It is idempotent with the nine modules that already call it. `SemiSymbolLogic.start` deliberately does NOT, exactly as Signum's does not: a SemiSymbol table is user-writable, so its module decides whether it has a page.
- **`@ticksColumn(true|false)`** (Signum's `[TicksColumn]`): whether the table carries a concurrency stamp. A Ticks column earns its place where a row is edited by PEOPLE, one at a time, so the DEFAULTS are: a **`@part` row has NONE** — it is reached and saved through its owner, whose own stamp guards the aggregate, and it is never edited alone — a SEEDED table has none, and everything else has one. The decorator overrides either default: `false` for logs and engine-written rows (Exception, OperationLog, Process, PackageLine, EmailPackage, the migration rows, SemiSymbol), `true` for a part that really is edited on its own. Unlike every other class-level flag it is INHERITED (a SemiSymbol subclass gets it from the base, as in Signum).
  **legacyMode gives the stamp BACK to the parts Signum models as real ENTITIES** (a dashboard part's content, an email service, a scheduler rule, a virtual-MList child), because their tables have one there — and which those are is DERIVED, never declared: a part reached through an owner's ARRAY is Signum's MList table (not an entity there at all), any other part stands in for a type with its own table. `mlistRowOwner` is that predicate — unless `@legacyTableName({ wasVirtualMList: true })` says otherwise — and legacyMode reuses it to give an MList table Signum's whole column shape: no ToStr, a `ParentID` back reference, an element column named from the element TYPE (`EntityID_User`, `TypeConditionID`) rather than from the field altea invented for the row, and an `Order` index column whatever the `@rowOrder` field is called (Signum builds it with a NULL route, so no property is behind it). That last one matters because the obvious name is often taken: `OrderLineEntity`'s back reference IS `order`, so its index has to be `rowOrder` — and legacy mode swaps the two into Signum's `ParentID` + `Order`. **An existing altea database needs a `sync`**: ~97 part tables drop their Ticks.
- **Enums**: a numeric `X` object + a string-union `type XKeys = keyof typeof X`; the **runtime/wire value is the STRING member name**, so compare with bare literals (`"Shipped"`), not `X.Shipped`. The enum takes the CLEAN name, because that name is reflection IDENTITY — the registered type name (`registerEnum(X)` is rewritten to `registerEnum(X, "X", …)`), hence the enum table, the `TypeEntity.cleanName` row, and the `<Type Name>` key of every translation file. The union is the derived thing, so it is what carries the suffix. It used to be the other way round (`XEnum` + `type X`), which put an `Enum` nobody wrote in the model into 36 table names — `basics.filter_operation_enum` where Signum has `queries.filter_operation` — and was followed inconsistently anyway (81 of 127 enums never took the suffix, eastwind's own entity enums included).
- **`@field` typeNames are capitalized**: `String` / `Number` / `Decimal` / `Boolean` / `PlainDate` / `Guid` / `Duration`, etc.
- **Reflection metadata is ONE global blob** (nice names + auth + queries + operations) shipped eagerly at boot.
- **`XxxInfo` vs `XxxMetadata` — the two halves of reflection.** `TypeInfo` / `FieldInfo` (`data/reflection`) are the **compile-time** descriptor the quote-transformer stamps onto each constructor: types, units, formats, validators, implementations — identical for every user and every culture. `TypeMetadata` / `FieldMetadata` / `OperationMetadata` (`data/metadata`) are the **runtime** half: per-CULTURE (nice names, plural, gender) and per-ROLE (`min/maxTypeAllowed`, `propertyAllowed`), assembled per request by `ReflectionServer.buildMetadata` and shipped as ONE `MetadataBlob`. Structurally this follows Signum — one entry per type carrying everything about it — but Signum's single `TypeInfo` family is split, so nothing per-role ever lands on the compile-time descriptor. Consequences: `TypeInfo` has NO `operations` / `hasConstructorOperation` / `gender`; read them via `Metadata.tryType(name)` or the client's `getOperationInfos` / `ti.getGender()`.
  - **`TypeMetadata.fields` is keyed by `PropertyRoute.propertyString()`**, so an EMBEDDED type's members appear dotted under every owning entity (`"shipAddress.city"`) — the same key `RulePropertyEntity.path` uses, which makes property authorization a direct lookup. An embedded/model type also gets its own entry; that one is where its translations live. NOTE the UI re-roots its PropertyRoute at each embedded it renders (`RenderEntity`, as Signum does), so a client-side rule lookup must climb the TypeContext chain to the owning entity (`AuthAdminClient.ownerRootedRoute`).
  - **An extension widens the model with `declare module`**, never a side-channel map — altea-auth adds the allowance fields in `altea-auth/data/Rules.ts` (the DATA layer, because a `declare module` only applies to programs that compile the declaring file, and the client tsconfig does not compile `server/`). Same rule, same reason, for the members a module registers as query EXPRESSIONS — see the registered-expression bullet below.
- **A REGISTERED EXPRESSION is DECLARED in `data/` and IMPLEMENTED in `server/`. This is the pattern; there
  is no second one.** Signum writes `[AutoExpressionField] public static IQueryable<AlertEntity>
  Alerts(this Entity e)` — an extension METHOD, which occupies no name on the type and is visible to
  everything that references the assembly. TypeScript has no extension methods, so altea puts the member on
  the type in two halves:

  ```ts
  // altea-alert/data/Alert.ts — the DECLARATION
  declare module "@altea/altea/data/entity" {
      interface Entity { alerts?(): IQuery<AlertEntity>; }
  }

  // altea-alert/server/AlertLogic.ts — the IMPLEMENTATION
  Entity.prototype.alerts = withQuoted(function (this: Entity): IQuery<AlertEntity> {
      return table(AlertEntity).filter(a => a.target!.is(this));
  });
  ```

  - **Why the halves split at all**: the body needs `table(...)`, which is server-only, while the
    DECLARATION has to reach the CLIENT — `QueryTokenString` lives in `client/`, so a member declared in a
    server file cannot be named by `token(a => a.alerts())`, which is what every `defaultColumns`,
    `findOptions` and quick link is built from. Declaring in `data/` is what makes the typed token builder
    work at all; a `declare module` only applies to programs that COMPILE the declaring file, and the client
    tsconfig does not compile `server/`.
  - **Never a local `type Target = Entity & { … }` at the register call, and never a cast to reach the
    prototype.** Both were tried and both are gone: the local type made the member invisible to every other
    caller (so no token could be built), and `(type as unknown as { prototype: Record<string, unknown> })`
    bought nothing — `Type<T>` now declares `prototype: T`, so `type.prototype.alerts = …` is CHECKED, where
    before it went through `Function.prototype`'s `any` and a typo in a stamped member name was silent.
  - **OPTIONAL (`?`) always**, because the member is a TOKEN only on the types the registration names —
    `AlertLogic.start` takes the list. The declaration says "any entity may carry this", the registration
    says "these types offer it", and the `!` at the call site is the reminder.
  - **Stamp ONCE on `Entity.prototype` when the body does not depend on the type** (alerts, viewLogs,
    entityNotes, operationLogs, systemValidFrom/To, previousOperationLog): the per-type function then holds
    only its `QueryLogic.expressions.register` calls. Stamp PER TYPE only when the body captures it —
    altea-tree is the one case, since `table(type)` must be a constant in the quoted tree.
  - **A per-type expression is typed by the polymorphic `this`**, not by a generic entity class:
    `treeChildren?(): IQuery<this>` on `TreeEntity` makes `DepartmentEntity.prototype.treeChildren()` an
    `IQuery<DepartmentEntity>`, so a token keeps walking into that type's own members. A `TreeEntity<T>`
    would say the same at the cost of a type argument on every reference in the workspace (plus an F-bounded
    `T extends TreeEntity<T>` to close the loop), and `this` is what core's own `Entity.inDB(): IQuery<this>`
    already uses.
  - **An INTERFACE instead of `Entity` only when it is a real CONTRACT** an app opts a type into and other
    code takes as a parameter — `ICaseMainEntity` (altea-workflow's client frames are typed by it),
    `ISMSOwnerEntity`. Those keep their own declaration in `data/`, and the stamp names it:
    `const proto = type.prototype as ICaseMainEntity`.
  - **Registering on `Entity` itself WORKS, and is how an expression every entity offers is written** —
    `QueryLogic.expressions.register(Entity, (e: Entity) => e.operationLogs!(), …)`, Signum's own shape,
    ONE call rather than a loop over `schema.tables`. The lookup always walked the base chain
    (`getExtensionsTokens` climbs `Object.getPrototypeOf` from the token's ctor), so an abstract base has
    always been inherited by its subclasses — altea-sms registers `SMSOwnerData` that way. What refused
    was the REGISTRATION, and only for the ROOT: the metadata visitor seeds the source parameter's meta
    with `Implementations.by(sourceType)`, and `Implementations.error` rejects anything whose prototype is
    not an Entity instance — which `Entity` itself is not. So `register(Entity, …)` compiled and then threw
    "Entity is not an Entity" at boot.
    - **`Implementations.ofDeclaredType(type)` is the fix**: `by(type)` for anything with a table, `byAll`
      for the root, because "an Entity" is precisely what ImplementedByAll means. Signum needs no such
      thing — it seeds an expression's source meta from the TOKEN being navigated
      (`MetaExpression.FromToken` → `token.GetImplementations()`), which for a polymorphic token already
      answers ImplementedByAll; altea asks by TYPE, so the root needed an answer. Only the root is
      special-cased: a Lite, an interface or a non-entity still throws, since those are mistakes rather
      than "any entity". (Signum's own `Error` additionally rejects any ABSTRACT type, so its
      `Implementations.By` is stricter than altea's, which accepts an abstract mapped base.)
    - the consequence is intended and is Signum's too: a root-registered expression is a sub-token of
      EVERY entity, including the declared type of an `@implementedByAll` reference — so
      `OperationLog.Target.OperationLogs` resolves. Pinned by two cases in
      `altea/test/server/dynamicQueries/expressionContainer.test.ts`, on a LOCAL `ExpressionContainer`:
      the registry is global and the suites share one process, so registering on the root in a fixture
      would show up in a sibling suite asserting an exact sub-token set.
- **The display-name API is fluent and typed, never a free function over a ctor.** `OrderEntity.niceName()` / `.nicePluralName()` / `.gender()` / `.newNiceName()`, `OrderEntity.nicePropertyName(a => a.orderNumber)` (and `AddressEmbedded.nicePropertyName(a => a.city)`), `Enum.niceName(ColorEnum, "Red")`, `someSymbol.niceToString()`, `fieldInfo.niceToString()`. The resolver engine behind them lives in `Localization.Internal` (`data/utils/localization`) and has exactly four legitimate callers — `data/entity`, `data/enum`, `data/symbol`, `data/reflection` — plus framework internals that only hold a bare name (the LINQ provider lowering `Type.niceName()` into SQL). A `Localization.Internal.` in application or extension code is a bug. Two gotchas on `nicePropertyName`: the lambda overload needs an INLINE lambda (the transformer emits `__quoted` only at a `Quoted<…>` parameter, and there is no toString fallback), and the transformer does NOT rewrite lambdas in JSX ATTRIBUTES — inside JSX pass the route as a string.
- **The MODEL RULES — `@bindParent`, `@isReadOnly`, `@validate` — are decorators writing reflection, and
  `propsMeta` is not how the client learns about them.** Signum answers "can this member be edited right
  now?" in `PropertyValidator.IsPropertyReadonly` (a per-property `IsReadonly` event, then the entity's
  `IsPropertyReadonly(PropertyInfo)` override, then a process-wide `GlobalIsReadonly`) and ships the answer
  as a `propsMeta` string array its client reads back; validation is a third virtual pair
  (`PropertyValidation` on the entity, `ChildPropertyValidation` on the PARENT) reached through a
  `[BindParent]` back-pointer. altea keeps every capability and reshapes the delivery:
  - **`@bindParent` on a field, and the parent lives in a WeakMap** (`data/parentEntity`). It is NOT the
    same thing as a `@part` row's `@backReference`, and neither substitutes for the other: the back
    reference is a `Lite` the SAVE cascade fills, so it is empty exactly when a rule needs it — while the
    graph is being edited, and while the owner may still be new. A field rather than a WeakMap was
    rejected because an own property would have to be kept out of the wire, out of the snapshot diff (or
    every entity with a parent reads back dirty), out of ObjectDumper and out of every `JSON.stringify` in
    a test, and it makes the graph cyclic.
    - **the read VERIFIES.** The slot records the member it was bound under and `tryGetParentEntity`
      checks the owner still holds this child there, so a child that was MOVED or REMOVED answers
      `undefined` rather than its old owner — where Signum, which stamps from the property setter and
      clears from the collection-changed event, answers confidently and wrongly. That is also why there is
      no `clearParentEntity`, and why `SetParentEntity`'s throw-if-already-owned is not ported: a throw
      inside a load pass is a landmine, and a wrong answer is already impossible.
    - **it takes a runtime `Type<T>`** — `tryGetParentEntity(line, OrderEntity)` — so the cast is CHECKED,
      where Signum's `TryGetParentEntity<T>()` resolves with an unchecked `as`. `tryGet` is silent on a
      mismatch (as that `as` is, and what lets a rule stand down), `getParentEntity` insists and names
      which of the two mistakes it was. `tryGetOwnerEntity(child, type)` CLIMBS to the nearest ancestor of
      that type, which is Signum's two-level `GetParentEntity` chain in one call. An INTERFACE has no
      runtime handle, so those callers pass `Entity` and cast — as Signum does too.
    - **four binding points, and the client one is the interesting half.** The codec (at the end of
      `applyFields`, one level per container — a nested modifiable is deserialized first, so the graph
      binds bottom-up), `Retriever.postRetrieved` before the Retrieved events, the Saver before PreSaving
      and validation, and **`Binding.setValue`** — altea's counterpart of the property setter Signum
      hooks. That last one is why Signum needs two mechanisms and altea one: every write a form makes goes
      through that single funnel, collections included, because `EntityListBase`'s add/remove mutate the
      array and then call `setValue(list)`. It is what makes a rule reading the owner answer while the
      user is still building the graph.
  - **`@isReadOnly` and `@validate` resolve field → declaring mixin → entity chain**, first
    non-`undefined` wins. `undefined` means "no opinion", so deferring is the DEFAULT — which is what
    replaces Signum's `super.IsPropertyReadonly(pi)` and why no rule needs a handle on the next one. A
    `false` WINS over everything below it, making `@isReadOnly(false)` on a field the escape hatch from a
    whole-entity rule that Signum cannot express (its per-property event wins only on `true`).
    - **`@isReadOnly` works at BOTH levels from one decorator**, dispatching on where it was put: on a
      field it is about that member, on a CLASS it is about every member at once — which is what replaces
      the entity override. Class rules are a LIST on the TypeInfo, walked up the prototype chain at
      RESOLVE time rather than copied at decoration time (a subclass's own would otherwise replace its
      base's, since `getOrCreateTypeInfo` seeds a subclass by shallow-copying its base). One decorator
      also covers both things Signum keeps apart at the field level — the static `MemberInfo.isReadOnly`
      boolean and the per-property predicate — because every reader asks through one resolver,
      `FieldInfo.isReadOnlyFor`.
    - **the type argument is written explicitly and is what makes the member name CHECKED**:
      `@isReadOnly<OrderEntity>((o, fi) => …)` types `o` and narrows `fi.name` to `MemberOf<OrderEntity>`,
      so a typo or a renamed member is a compile error — TypeScript having no `nameof`. Name the CLASS,
      never `this`: `keyof this` compiles and then checks nothing (inside the method it is a deferred
      type), and on `BaseEntity` it would make the class's own structure `this`-dependent, which costs
      TypeScript its variance shortcut for every generic over it and stops the Lines layer compiling.
      There is no default type parameter, so forgetting it fails to compile rather than silently checking
      nothing. `fi` is the real FieldInfo with a narrowed `name`, so `niceToString()` and `declaringType`
      still work.
    - **a class rule must NAME the states that bite, never negate the initial one.** altea does not
      initialize a field to its type default, so a fresh entity's enum is `undefined`, not `0` — and
      `state === New ? undefined : true` therefore froze every NEW order solid. Signum is only safe from
      that because C# initializes the field. Pinned by a case in `altea/test/data/modelRules.test.ts`.
    - **a MIXIN's member is not in its owner's `MemberOf`**, since the owner's class does not declare it.
      A blanket class rule on the owner still covers it (which the write gate needs); a rule that NAMES it
      goes on the mixin, where it is declared. `fi.declaringType` tells the two apart.
  - **`resolveField` / `eachFieldInfo` are the two-level field walk** (own + inherited + each declared
    mixin), and every reader goes through them. A mixin keeps its OWN TypeInfo — `OrderLineEntity.fields`
    has no `discountCode`, `OrderDetailMixin` does — so a bare `TypeInfo.fields[member]` silently answers
    undefined for one. That was a live bug, not just a gap: the client's `Binding.getError` used the bare
    lookup, so a mixin field's validators — the implicit NotNull included — never ran in the live pass and
    the user only found out on save.
  - **so `propsMeta` is not needed for this.** All of it lives in the ISOMORPHIC data layer, so the same
    rules run on the client: the answer is re-evaluated on every render and follows the entity in hand,
    and it holds for an entity the client just CONSTRUCTED, which never had a propsMeta. The array is
    still written (property AUTH fills it), and `Binding.getIsHidden` stays false — altea-auth enforces
    that dimension through its own line task rather than a second path to the same answer.
  - **`@validate<T>` is the former `@fieldValidation` / `customValidators`**, and the validator decorators
    are no longer re-exported from `data/decorators`: `@stringLengthValidator` and friends come from
    `data/validators`, which is where they live. One home per thing.
  - **the enforcement points**: the client Lines layer (`Binding.getIsReadonly`, applied per line by
    LineBase's `taskSetReadOnly` — and a read-only line CASCADES, so marking a collection read-only makes
    its whole EntityTable read-only) and the serializer's WRITE gate, Signum's `AssertCanWrite`. That gate
    runs only on the OVERLAY path (the server applying a POSTed graph onto the retrieved original), so it
    reads the STORED state and the client-receive path is untouched; it keeps the codec's silent-keep
    where Signum throws, which cannot falsely reject a save.
  - NOT ported: Signum's process-wide `Validator.GlobalIsReadonly` (no consumer), and
    `ChildPropertyValidation` — which needs no counterpart, because with a parent back-pointer a rule on
    the child that depends on the owner IS a rule on the child. Southwind's discount rule (a line's
    discount must be a multiple of 5% unless the order is legacy) is a `@validate` on
    `OrderLineEntity.discount` reading `tryGetParentEntity(l, OrderEntity)`, where Signum has to write it
    as an override on the ORDER switching on `pi.Name`.
  Consumers so far: `SemiSymbol.name` (read-only once the row carries a `key` — a row DECLARED in code
  owns its name, which is the whole difference between the two halves of a SemiSymbol table), the sixteen
  `EvalEmbedded` fields — which retired altea-eval's private owners WeakMap AND its `withEvals()` fluent
  method: `EvalEmbedded.owner(type)` reads the shared back-pointer, and the `Reset()` `withEvals` also stood
  in for (Signum drops the compilation from the `Script` SETTER, which altea has none of) is gone too, since
  the compilation memo now records the script it was built from — a hit counts only while that is still the
  script on the instance, which also covers the case the retrieve hook never did — and
  eastwind's `OrderEntity`. Pinned by `altea/test/data/modelRules.test.ts` (16 DB-free cases).
- **An operation's owning type is its FIRST CONSTRUCTOR ARGUMENT, not an option.** `new Graph.Execute(OrderEntity, OrderOperation.Ship, { execute })` — the argument stands in for the erased generic (Signum writes `new Graph<OrderEntity>.Execute(sym)` and reads T back through reflection), and the alternative is guessing the owner by splitting the symbol key (`"OrderOperation.Ship"` → `OrderEntity`), which silently lost every operation whose container is not named after its type. As an argument it cannot be forgotten, and it reads in the same position as `sb.include(OrderEntity)`. It is still almost never written by hand, because the surrounding registration passes it: every `sb.include(X).with*` method uses the type the include was opened for (see the next bullet). What stays explicit is what that cannot know:
  - **`ConstructFrom` / `ConstructFromMany`**, whose owner is the **SOURCE** type F — that is where the button appears, and F is erased too, so the enclosing graph cannot know it. Both take it FIRST: `.withConstructFrom(CustomerEntity, OrderOperation.CreateOrderFromCustomer, { … })`. This is real information, not boilerplate: the old key heuristic got it wrong for 4 of the 5 cross-type constructors in the repo.
  - an operation shared by an ABSTRACT base's implementations. Subclasses inherit it (`OperationLogic.operationsForType` walks the prototype chain), so ONE registration owned by the base covers them all — `withSave` cannot express that, since it owns the operation with the type the include was opened for (see eastwind's `CustomerOperation.Save`).
  - an owner that is a TS INTERFACE and so has no constructor: each implementor adds itself via `OperationLogic.registerForType` (order-independent by design — the implementor may be wired before the operation is registered).
- **Operations are declared ON THE INCLUDE, and there is no separate registration step.** `server/fluentOperations.ts` widens Signum's `FluentInclude.WithSave` / `WithDelete` to every operation kind, so a type's whole operation surface hangs off the `sb.include(X)` that opens its table:

  ```ts
  sb.include(OrderEntity)
      .withQuery()
      .withStateMachine(o => o.state, registerOrderOperations);   // or an inline `sm => { … }`
  ```

  Two surfaces, and which one you get is decided by where you are. `FluentOperations<T>` — what `FluentInclude<T>` is — carries `withSave` / `withDelete` / `withExecute` / `withConstruct` / `withConstructFrom` / `withConstructFromMany`, with NO state members on their option objects. `withStateMachine(getState, define)` opens a `FluentStateMachine<T, S>` whose same six methods take the `…OptionsWithState` variants: S is inferred from the selector, the selector is stamped onto every operation the block declares, and `fromStates` / `toStates` are **required** — Signum asserts exactly those at registration time (`GraphState.cs` `AssertIsValid`), per kind: Construct / ConstructFrom / ConstructFromMany need `toStates`, Delete needs `fromStates`, Execute needs both. So a `fromStates` written where nothing could check it, and a state guard forgotten where one is needed, are both compile errors. An operation inside a stateful graph that genuinely has no transition (Signum declares plenty) goes on `sm.parent`, the stateless surface the state machine was opened from.

  Both `withStateMachine` and `withOperations` take a plain callback, so a large graph is still a NAMED FUNCTION outside `start` — `registerOrderOperations(sm: FluentStateMachine<OrderEntity, OrderState>)` — which is what Signum's separate `OrderGraph` class bought, minus the class and minus the `register()` call that could be forgotten (two altea-dynamic graphs had been written inline with the result DROPPED, so `DynamicViewOperation.Create/Clone` and `DynamicSqlMigrationOperation.Create/Execute` did not exist at runtime at all — an include cannot fail that way). Keep it inline when it is two or three defaults; extract it once it has bodies.

  There is no second root: `FluentOperations<T>` IS `FluentInclude<T>`, and `sb.include` is idempotent, so the two cases with no include of one's own — a `Type<T>` known only at RUNTIME (altea-tree's `registerOperations(include)`, which takes the include `withTree` hangs off) and a module that owns a type's operations but not its include (altea-workflow's `WorkflowEventTaskLogic` on `CaseEntity`) — just open one: `sb.include(CaseEntity).withOperations(…)` reaches a type another module included. For full control over ONE operation — holding it, mutating it later, re-registering it with `replace` — use the `new Graph.Execute(Order, sym, { … })` classes directly (`server/graph.ts`). This replaced the earlier `graph(Order, OrderState, g => { g.GetState = …; g.Execute(sym, …) })` builder, whose verbs read as "construct something" rather than "register an operation".
- **`@quoted` lambda navigations**: `entity.customer.name`-style navs inside queries are rewritten by `quote-transformer` (a ts-patch transformer). A nav off a **nullable** reference must use `singleOrNull` / `firstOrNull` (OUTER APPLY), not `single` / `first`.
- **Rule sets live in `client/FinderRules.tsx`** (like Signum), not inline in `Finder.tsx` — the editors import Lines, and Lines import Finder, so keeping them separate avoids a module-eval import cycle. Finder imports `FinderRules` for its four `init*Rules()` and installs them, so `import { Finder }` is enough.

- **Physical NAMING is overridable on both builders, as it is in Signum.** Signum makes its naming
  `virtual` on `SchemaBuilder` (`GenerateTableName`, `GenerateFieldName`, `GenerateCleanTypeName`, …); altea
  spreads the same decisions over two classes plus `SchemaSettings`, and each is an override point:
  - ENTITIES — `SchemaSettings.tableName(type)` / `.schemaForType(type)` for the table, and
    `SchemaBuilder.columnName(fi)` / `.idiomatic(logical)` for the columns. Signum's `GenerateFieldName`
    bundles three things (the per-field name, the `ID` suffix keyed by `KindOfField`, and `Idiomatic`);
    altea splits them, so `columnName` is the CONVENTION only and cannot change the `ID` rule itself. Reach:
    `columnName` sees every field a FieldInfo describes — value, embedded (whose members it then prefixes), a
    reference's `<Field>ID`, an enum's, and each `@implementedBy` / `@implementedByAll` implementation column
    — and `idiomatic` additionally covers the fixed `ID` / `Ticks` / `ToStr` / period columns, which have no
    FieldInfo to route. A `@backReference` needs no counterpart of Signum's `GenerateBackReferenceName`: it
    is an ordinary reference field on the child.
    An explicit **`@column({columnName})` IS the column name** — verbatim, no prefix, no `ID` suffix, no
    dialect mapping — read where Signum reads its `[ColumnName]` (before any convention applies), so it means
    the same thing for every kind. One divergence, in the corner Signum composes: for `@implementedBy` /
    `@implementedByAll` one field owns SEVERAL columns, so Signum appends the implementation to the given
    name (`Foo_Artist`) while altea THROWS — naming those is what subclassing is for. Signum's
    `[BackReferenceColumnName]` / altea's former `@fkProperty` are both gone here: one option names a column,
    whatever kind of field it sits on. `columnNaming.test.ts` pins all of it.
    Auditing that pair found a BUG: `@column` used to default its `columnName` option to the raw property
    key, so `columnName`'s `cap(fi.name)` fallback never ran for a decorated field and it got a camelCase
    column beside its PascalCase siblings (`exceptionType` next to `ExceptionMessage` on `ExceptionEntity`).
    Postgres hid it — `pascalToSnake` maps both spellings to the same name — so it only ever showed on SQL
    Server. Fixed by leaving the option unset; **a SQL Server database therefore needs a `sync` to rename
    the ~19 affected columns** (ExceptionEntity's eleven, RestLog/RestApiKey's six, `UserEntity.passwordHash`,
    `EmployeePassageEntity.embedding`). No Postgres database is affected.
  - VIEWS — `ViewBuilder.tableName(typeInfo)` / `.columnName(fi)`, for reading a FOREIGN database whose
    spelling is not altea's (see the Northwind bullet). Not applied to a temp-table view's FK column: a temp
    table is CREATED by altea, so its names are altea's already.
  Two asymmetries worth knowing. A `SchemaBuilder` subclass is used by CONSTRUCTING it (the app writes
  `new SchemaBuilder()` in its Starter), whereas a `ViewBuilder` is constructed by `Schema.view()` — hence
  the `Schema.viewBuilder` slot, and no equivalent slot for the SchemaBuilder. And **`cleanTypeName` is
  deliberately NOT a hook**, where Signum's `GenerateCleanTypeName` is virtual: in altea it is the
  reflection IDENTITY (the `TypeEntity.cleanName` column, the serialization discriminator, the suffix of an
  `@implementedBy` column) and it is computed in the DATA layer, which the client compiles too — so a
  server-side override would let the two halves disagree about what a type is called.

- **Signum.Alerts → altea-alert: a notification is an entity, and the bell is a WebSocket consumer.** The
  module ports whole (entity + operations, the two endpoints the bell polls, the dropdown, the alert view,
  and the opt-in "mail me my pending alerts" task). Divergences:
  - **AlertTypeSymbol is a SemiSymbol**, as in Signum — altea has one now (`data/semiSymbol` +
    `server/semiSymbolLogic`). An alert type is normally DECLARED in code via
    `AlertLogic.registerAlertType`, and its Save/Delete operations and its editor go with it; a user may
    also create one (a name, no key), which the synchronizer then leaves alone.
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

- **The Northwind SOURCE database is seeded, on either dialect, and its images come off disk.** Southwind
  assumes a Northwind database is already installed (the SQL Server sample everyone had), so
  `NorthwindSchema.cs` needs no seed and no dialect question. eastwind runs on both, so `terminal
  seed-northwind` — also the FIRST `csharp` migration, so that command is self-contained — creates it from
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
    loaders take the pictures from `terminal/image_categories` + `terminal/image_photos` instead
    (`northwindImages.ts`, by base name with the extension discovered from the directory), the same bytes on
    both dialects. Hence no `Picture` column on `NwCategory` and no `RemoveOlePrefix`. A category name may
    hold a slash, so ONE mechanical rule maps it to a file (`Grains/Cereals` → `Grains-Cereals`); an
    employee photo is `<FirstName> <LastName>`.
    `EmployeeEntity.photo` is a `FileEmbedded` where Southwind holds a `Lite<FileEntity>` — the shape
    `CategoryEntity.picture` already uses, so the demo needs no FileEntity table and no FileType of its own.
    **An existing database therefore needs a `terminal sync` before an employee photo has a column to live
    in.**

- **App settings are ONE persisted row, and every module start takes a lambda to it.** eastwind ports
  Southwind's `ApplicationConfigurationEntity` (`eastwind/globals/`): one row per environment carrying each
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

  Full ledger for all three directory modules:
  **[altea/docs/port/AuthDirectory.md](altea/docs/port/AuthDirectory.md)**.

- **A REMOTE file store cannot rename, and cannot be read synchronously.** `altea-files` splits a save into
  a SYNC `prepareSuffix` (assign the suffix, so the owning row can be INSERTed with it) and an ASYNC
  `writePrepared` (write the bytes just before commit). `altea-files-azure` / `altea-files-s3` therefore
  **REFUSE a `renameAlgorithm`** — the collision probe is a network round-trip, and a rename decided in the
  async half could not be written back to the row that already carries the old suffix — and
  `readAllBytesSync` THROWS in both, so **a `BigString` column must not live in a remote store**. Signum's
  chunked-upload API is not ported at all: altea-files has no chunk protocol, a file reaching the server
  inside the entity graph. Full ledger:
  **[altea/docs/port/FileStores.md](altea/docs/port/FileStores.md)**.

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
  (`winmail.dat`) unpacking on reception. Per-module ledgers:
  **[MailingExchange.md](altea/docs/port/MailingExchange.md)**,
  **[MailingPop3.md](altea/docs/port/MailingPop3.md)**.

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
  start caching X (Signum force-caches it); the lazy keeps its event wiring and is also reset by a
  broadcast. Full ledger: **[altea/docs/port/Cache.md](altea/docs/port/Cache.md)**.

- **The diff log is TWO core seams plus a mixin.** altea-diff-log stores the before/after dumps of an
  operation on the operation log itself, which needed `ObjectDumper` (`data/objectDumper`, keeping Signum's
  C#-flavoured output VERBATIM — that shape is the contract `simplifyDump`'s regex reads, and what makes a
  dump comparable across the two frameworks) and `OperationLogic.surroundOperation` — a before-handler
  returning an AFTER callback, which still runs when the operation threw. Note the MIXIN's two consequences:
  the fields are FLATTENED onto `operation_log` (`initial_state_text`, …), but a client PropertyRoute still
  needs the mixin STEP (`subCtx(a => a.mixin(DiffLogMixin))`), because a route models the mixin even where
  the columns don't. Full ledger: **[altea/docs/port/DiffLog.md](altea/docs/port/DiffLog.md)**.

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

- **Signum.Dynamic ports WHOLE, and the compiled half rests on running the quote-transformer at RUNTIME.**
  `altea-dynamic` has both halves. The INTERPRETED one — `DynamicView` / `DynamicViewOverride` /
  `DynamicViewSelector` (a view is a JSON node TREE plus small JavaScript snippets, interpreted
  client-side), `DynamicCSSOverride` and `DynamicSqlMigration` (both plain text) — needs no compiler. The
  COMPILED one — `DynamicType`, `DynamicExpression`, `DynamicValidation`, `DynamicApi`,
  `DynamicTypeCondition`, `DynamicMixinConnection` — does what Signum does: GENERATE source into a
  `CodeGen` directory, compile it, load it, and restart so the new types take part in the schema (then a
  `sync` for their tables). `DynamicIsolation` is there too, and is the one that is OPT-IN (off by
  default): @altea/altea-isolation refuses to start unless EVERY table declared a strategy, so
  generating `Isolation.register` calls for an app that never started it would commit it to that
  assertion by accident — Signum has the same hazard and the same answer.

  This bullet used to say the compiled half was "a design project, not a port", because altea's entity
  model is stamped at BUILD time by the quote-transformer. That was the wrong conclusion from the right
  fact: the transformer's factory takes a `ts.Program` and returns an ordinary `ts.TransformerFactory`, so
  it composes into `program.emit` exactly as it does under `tspc` — which is what
  `DynamicCodeCompiler` does. Putting it in the emit pipeline is not optional: the transformer is what
  synthesises `@field({ typeName … })` from a type annotation, stamps `__fileInfo`, rewrites `init()` with
  its key, and turns a `@quoted` lambda into the expression TREE the LINQ provider lowers. Generated code
  that skipped it would compile and then be invisible to reflection and unquotable in a query.

  Which pieces GENERATE and which merely EVALUATE is not a port decision — it follows from what each needs,
  and Signum answers the same way: an expression and a type condition must reach the LINQ provider as
  TREES, a mixin's fields must be COLUMNS before the schema is built, and a route must exist before a
  request arrives, so those four are generated; a VALIDATION is asked about an entity in hand, so it is an
  `EvalEmbedded` on @altea/altea-eval. (DynamicTypeCondition and DynamicApi carry an EvalEmbedded too, but
  only so the editor can compile and test the script.)

  Consequences and divergences worth knowing:
  - **the emit is ESM and loading is `import()`.** Not interchangeable: TypeScript's CommonJS module
    transform ELIDES an import a `before` transformer synthesised, so the module compiles and then dies on
    `field is not defined`; and `import()` is what makes a generated module share module IDENTITY with the
    process (Node keys its ESM cache by resolved URL), so a generated type registers into the reflection
    registries the SERVER reads. Roslyn's `MetadataReference` list therefore becomes ordinary resolution,
    with no allow-list to maintain.
  - **an APP's own modules need `typesRoots`, pointing at its DIST.** Nothing depends on an app, so
    TypeScript cannot resolve `eastwind/orders/Order.data`; `dist` carries the `.d.ts` beside the `.js`, so
    one directory serves checking and loading exactly as a published package does (a source root
    type-checks and then fails at load). The emitted specifier for such a package is RELATIVE —
    `DynamicCodeCompiler.specifierFor` is the single place that decision lives — because Node cannot
    resolve a bare `eastwind/…`.
  - **reading the DynamicType rows must TOLERATE a type-cache mismatch** (`StartParameters
    .withIgnoredDatabaseMismatches`): the read needs TypeLogic's type↔id caches, and building those
    compares the database's `type` rows against the schema's types — but at that moment the schema
    deliberately lacks the dynamic types, since generating them is what the read is FOR. The real check
    still runs at `schema.initialize()`. Signum needs none of this: its type cache is built in
    `Schema.Initialize`, after `Start`.
  - **a compile failure is DATA, not a throw.** `DynamicLogic.codeGenError` is carried so the server still
    BOOTS (otherwise a bad definition could only be fixed in the database by hand), every later step checks
    it first as Signum's do, and `registerExceptionIfAny` warns — including that a `sync` would now script
    the missing types as DROPs. `/api/dynamic/compilationStatus` + the `/dynamic/panel` page are how an
    author sees it, since the diagnostics exist only in the process that tried.
  - **an operation symbol is written `init()`** in generated code, and the transformer fills in the key.
    Signum must spell out `OperationSymbol.Execute<XEntity>(typeof(XOperation), "Save")` because C# cannot
    see the member name — the clearest illustration of why the transformer belongs in the emit.
  - **the definition read PROJECTS, and a generator wanting a mixin's field reads it itself.** Reading the
    whole `DynamicTypeEntity` makes the definitions unreadable the moment an optional MIXIN adds a column
    to `dynamic_type` (DynamicIsolation's does) — raised at exactly the point the definitions are needed
    to BUILD the schema, and a schema built without them scripts every dynamic table as a DROP. So
    `getTypes()` selects the four columns that are always there, and `DynamicIsolationLogic.strategies`
    does its own tolerant read (warn, treat everything as None) so the `sync` that adds the column can
    run. That column also stores the strategy's NAME, where Signum stores its enum ordinal: altea's
    `IsolationStrategy` is deliberately a string union, and giving that module a reflected enum for one
    consumer would add an enum table and touch every comparison in it.
  - **`DynamicMixinConnectionEntity.entityType` is a PLAIN reference**, as every other `Lite<TypeEntity>`
    in the workspace is. It carried a single-implementation `@implementedBy(() => [TypeEntity])` that
    nothing recorded a reason for, and that costs two things a Signum database sees: the column takes the
    implementation suffix (`EntityTypeID_Type`) and the polymorphic always-nullable default, where Signum
    has a NOT NULL `EntityTypeID`. The visible symptom was the read above FAILING against a Signum
    database — `Could not read the dynamic definitions: column dmc.entity_type_id_type does not exist` —
    so every Southwind sync was built from a schema with NO dynamic types, exactly the state that scripts
    every dynamic table as a DROP. `dynamic.dynamic_mixin_connection` now matches Signum column for
    column and a Southwind sync scripts nothing for it (500 → 492 statements).
    **An existing altea database needs a `sync`, and this is the case the "run it TWICE" rule is for**:
    the first sync cannot read the definitions (the model wants the new column, the database has the old
    one), so its script carries the column change AND a DROP of every dynamic table. Apply the column
    change alone — answering the rename prompt makes it a `RENAME COLUMN`, so no row loses its type —
    then re-run the sync and apply that one.
  - **`MList<T>` becomes a generated `@part` ROW type plus a `T[]`.** Signum's
    `DynamicTypeBackMListDefinition` (TableName / PreserveOrder / OrderName / BackReferenceName) describes
    that row table one for one.
  - `isNullable` / `uniqueIndex` inside the JSON definition are the member NAMES, as Signum's
    `JsonStringEnumConverter` writes them — so a definition round-trips between the two frameworks. Only
    `DynamicBaseType`, which is a real column, is an altea enum.
  - no `CodeGenExpressionMessage` enum and no `ColumnDisplayName`: altea takes a column's caption from the
    member's own `@niceName`, and there is no QueryDescription to hang a display name on. `queryFields` are
    CLIENT default columns, because the server's `withQuery()` takes no projection — so the designer's
    query tab lists member NAMES, not `e.Id`-style projection lines.
  - a DynamicApi script is a FUNCTION THAT REGISTERS ROUTES, not a controller-class body (altea has no
    controllers), which retires `IDynamicApiEvaluator.DummyEvaluate` and the second controller assembly.
  - `DisabledMixin` does not exist, so `isDisabled` is a plain field keeping the mixin MEMBER's name —
    hence Signum's own `IsDisabled` column, on DynamicApi and DynamicValidation alike. A validation's
    `SubEntity` IS a `PropertyRouteEntity` (see that bullet), but its APPLICABILITY test stays a route
    PREFIX rather than Signum's `PropertyRoute.MatchesEntity(mod)`, because altea re-roots a route at
    each embedded.
  - **no RESTART button** on the panel: Signum's restarts the ASP.NET host in place behind a supervisor,
    which Node has no convention for. `DynamicPanelPermission.RestartApplication` IS ported and the page
    says a restart is needed.
  - `TypeHelp` is not ported (the honest equivalent is editor IntelliSense over the same `.d.ts`), so the
    type combo is a text box with a datalist and the "property template" modal is gone;
    `TypeHelpComponent`'s one needed function is `client/View/FieldExpression.ts`.
  - it forced a CORE seam: `globalValidators` (`data/reflection`), Signum's `Validator.GlobalValidation` —
    the one thing a per-field decorator cannot express, a rule chosen at RUNTIME for a type the rule's
    author does not own. It runs after the declared validators and before the field's own
    `customValidation`, first message wins, and an async result is honoured on every server path and
    skipped on the client's live pass (as `customValidation` already is).
    `@altea/altea/data/reflection` also became an eval-visible framework module, since a validation script
    is handed a FieldInfo.
  - the interpreted half's own consequences, unchanged: it forced `Navigator.ViewDispatcher` /
    `BasicViewDispatcher` / `setViewDispatcher` (altea resolved views inline, with a
    `// TODO: real ViewDispatcher` where the seam belonged), and `applyViewOverrides` now asks the
    DISPATCHER for overrides so a module can contribute them for a type it does not own.
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
  `userKey` the client passes (Signum trusts the argument), so a tab cannot register presence as someone
  else. That module's ledger: **[altea/docs/port/ConcurrentUser.md](altea/docs/port/ConcurrentUser.md)**.

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
  Also: `AgentSymbol` is a `SemiSymbol`, as in Signum (altea has one — see the Symbol/SemiSymbol bullet);
  `QueryDescription` is gone, so the `queryDescription` tool becomes `QueryTokens` over the
  token tree and `qd.NextAlternatives` becomes a walk to the longest valid token prefix; the query grammar the
  instruction files teach is altea's (ROOTLESS, otherwise PascalCase like Signum's — see the token bullet);
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
  - **The Inbox is named by its ROW MODEL** (`InboxRowModel`, whose clean name strips the suffix, so `/find/Inbox`), not by Signum's
    `CaseActivityQuery.Inbox` enum member — altea has no QueryDescription, so a manual query's name IS its row
    type and each caption is the field's own `@niceName`. Its tokens used to be camelCase literals, because
    the SERVER's `QueryLogic.getToken` was an exact Map lookup while `Type.token()` PascalCased as Signum's
    `tokenSequence` does — the mismatch the token bullet describes, and now fixed at the source.
  - `MList<T>` is gone, so `mainEntityStrategies` / `actors` / `decisionOptions` / `viewNameProps` are `@part`
    rows — which is why the designer has its own main-entity-strategy checkbox list (core's
    `EnumCheckboxList` edits an array OF an enum, not of rows) — and `WorkflowActivityEntity.boundaryTimers`
    (Signum's VirtualMList) is a NON-PERSISTED `@column(false)` list the graph loader fills.
  - bpmn-js is pinned to Signum's exact 7.5.0 (+ diagram-js-minimap 2.0.4) with hand-written typings; the
    custom renderer / context pad / popup menu / minimap are Signum's. `componentWillReceiveProps` becomes
    `componentDidUpdate`. Signum's older navbar `WorkflowDropdown` is NOT ported (its toolbar menu config
    superseded it). altea has no `AutoLineModal`, so "pick an expiration date" and "edit remarks" are two
    small local modals.
  - Not ported: `MyActiveAlerts` (no Signum.Alerts), Signum's SMS module and
    `registerWhenAlreadyFilteringBy`. (`PackageExecuteAlgorithm<T>` used to be listed here too — "the
    timeout process walks its own package lines", which is true and is why this module needs none of it;
    PackageLogic IS ported now, see altea-processes below.) (Instance
    translation of a workflow / activity name IS available now — see altea-translations below — but the
    workflow module does not opt its own routes into it.)

- **Signum.Help → altea-help: the prose is GENERATED, and what is stored is only the overrides.** A help
  page shows one sentence per type / property / operation / query / query column, assembled from
  reflection by `HelpGenerator` (free, per request, never stored) with any human-written description
  layered over it — which is why a page is never empty and why the four tables stay small. Divergences:
  - a property's help points at a **`PropertyRouteEntity`** row, as in Signum (see that bullet), so its
    column is `property_id` and Signum's delete cascade from PropertyRouteEntity is registered here. A route
    that no longer exists is ALSO dropped when the XML is read — the routes table's own sync repairs a
    renamed path in place, so the two do not overlap.
  - **`NamespaceHelpEntity.name` holds a PACKAGE + FOLDER** — the same grouping string @altea/altea-map's
    schema map colours by (`getLocation` off the transformer's `__fileInfo`), so the map and the help index
    agree on what a module is. The INDEX page's first level is the package; the `(in …)` sub-label is shown
    only when the folder tail says something the title does not.
  - **there is no static COLUMN list for a query.** Signum reads `IDynamicQueryCore.StaticColumns`; altea
    has no QueryDescription, so a query's documentable columns are the ROOT TOKEN's immediate sub-tokens
    and `QueryColumnHelpEmbedded.columnName` holds a rootless token key. Strictly more capable, and it is
    what the column chooser's first level shows.
  - **MList → `@part` rows for the four stored collections, but EMBEDDEDs for the two import models.** A
    `@part` collection's `@backReference` needs a real owner TABLE, and a ModelEntity has none — the
    serializer's recover step then has no lite to build (`slot.owner.toLite is not a function`). The
    preview / report lines are therefore plain `EmbeddedEntity`s, the shape altea-user-assets'
    `UserAssetPreviewLineEmbedded` already uses.
  - **`HelpSearch` is WIRED UP — in Signum it is dead code.** Nothing calls `.Search(`, there is no
    endpoint, no `/help/search` route, and `Urls.searchUrl` (which the omnibox's "help 'text'" suggestion
    navigates to) both 404s and runs `getQueryKey` over what is a free-text string. The scan itself is
    complete, so the port keeps it and adds the missing route, page and URL helper.
  - **the constructed type of a ConstructFrom is not named.** Signum reads `operationInfo.ReturnType` off
    `Graph<F,T>`; TypeScript erases it. Filling Signum's "Constructs a new {0}" with the SOURCE type is
    actively wrong (altea-alert's `CreateAlertFromEntity` on `Entity` came out as "Constructs a new
    Order"), so those two reuse the Execute phrasing, which is true whatever they build.
  - **the export/import is ONE kind-descriptor table**, not Signum's four near-identical ~250-line static
    classes; the zip layout and XML are byte-compatible (`Help/<culture>/<Type|Namespace|Appendix|Query>/
    <key>.help` + a sibling folder of images). `System.IO.Compression` → **fflate**, `XDocument` →
    **fast-xml-parser** (both already the workspace's). NOT ported: the INTERACTIVE console mode (the web
    preview supersedes it) and the XSD validation (it only guarded the unported disk path).
  - `altea-html-editor`'s `ImageHandlerBase` seam is FILLED by this module (its header said "Signum's lives
    in Signum.Help, which is not ported"). `ImageInfo.binaryFile` is base64 on both sides, but altea's
    `FilePathEmbedded.binaryFile` is a `Uint8Array`, so the handler converts at that boundary.
  - `Schema.ForceCultureInfo` has no counterpart: the culture falls back request UI culture → its language
    → the first supported CultureInfoEntity row. `EntityCache(ForceNew)` likewise (altea has none);
    `Transaction.forceNew` + `ExecutionMode.global` are kept, and each per-culture cache load is memoised
    as an in-flight PROMISE so two concurrent first requests share one read.
  - the `[t:Order]` / `[p:Order.shipDate]` link tokens survive verbatim — they are the one piece of
    Signum's wiki syntax that a WYSIWYG editor cannot replace, because they are environment-independent
    references where an `<a href>` is not. `HelpSyntaxMessage` shrinks to the two labels still in use.
  - eastwind gains a third file store, `EastwindFileStores.store("help-images")` — Southwind keeps the same
    thing as `Folders.HelpImagesFolder`, a configured path (see the ApplicationConfiguration bullet).

- **Signum.Map → altea-map: two DERIVED views, so the module owns no tables.** Both pages are computed
  from things that already exist — the live `Schema`, the operation registry, and the database's own
  catalog views — so `MapLogic.start` is only two routes, the colour providers and an omnibox generator.
  It forced ONE core seam and surfaced one core bug:
  - **`Graph<T,S>.GetState` is now a `Quoted`** (`server/graph.ts`, and the selector `withStateMachine` takes, read back through
    the new `IGraphStateOperation` in `server/operation.ts`). Signum's is an `Expression<Func<T,S>>`, and
    the operation map needs it as a TREE, not just a callable: it is the `groupBy` key that counts each
    state's population in SQL, and its member list IS the query token the state node's Ctrl+Click filters
    by. `Quoted<F>` is `F & { __quoted? }`, so a plain `o => o.state` selector compiles and
    behaves unchanged.
  - **the quote-transformer was not stamping ASSIGNMENTS to an OPTIONAL quoted member.**
    `isQuoteTypedLValue` used the bare `isQuoteOfT`, which rejects the `Quoted<…> | undefined` union an
    `X?: Quoted<…>` declaration has — so assigning the selector silently produced no tree (the sibling
    branches of `assignedToQuoteOfT` already used the union-aware predicate). Fixed there.
  Divergences:
  - **MList is gone, and with it half the schema map.** Signum draws a table's MList tables as extra CHILD
    nodes (`TableInfo.mlistTables`) joined by an `mlist_arrow`, plus an `EntityBaseType.MList` shape. In
    altea a collection is `@part` CHILD ROWS of an ordinary table, i.e. always Signum's VirtualMList shape
    — already a node, already an edge. So `mlistTables` / `MListTableInfo` / `MListRelationInfo` /
    `isMList` / the MList node kind are NOT ported; what survives is the arrow that made a virtual MList
    readable, `isVirtualMListBackReference` → **`isBackReference`** (straight off `FieldInfo.isBackReference`,
    where Signum has to look the route up in `VirtualMList.RegisteredVirtualMLists`). `SemiSymbol` goes too.
  - **`namespace` is the owning PACKAGE plus the declaring FOLDER** (`@altea/altea-auth/data`,
    `eastwind/orders`), read off the transformer's `__fileInfo` through `getLocation` — the same grouping
    altea-translations uses. An ENUM table has no registration of its own, so its location is the enum's.
  - **the state ENUM is discovered through the selector's PROPERTY ROUTE**, not a generic parameter (S is
    erased): `PropertyRoute.root(T).addLambda(getState).type.getEnum()` yields the enum object, hence every
    member, `Enum.isNotMapped` (Signum's `[Ignore]`) and `Enum.niceName`. It also crosses the
    ordinal↔name boundary in both directions — `withStateMachine(t => t.state, …)` infers S as the enum's numeric
    values, so `toStates: [OrderState.Shipped]` stores `2` while `MapState.key` is the NAME.
  - **one state machine per operation map.** Signum supports several state types per type; here
    `operationsForType` walks the prototype chain, so an operation registered on an ABSTRACT BASE arrives
    with a FOREIGN enum's states (altea-alert's `CreateAlertFromEntity` on `Entity`, `toStates:
    [AlertState.New]`) — those would be drawn as this type's state 0, so an operation whose selector is not
    this map's is treated as state-unaware (Start → End). `fromToStates` is not ported either (altea's
    Graph.* have no such option), so a transition set is the cartesian product — Signum's own client
    fallback.
  - **single database**: `Schema.DatabaseNames()` / `OverrideDatabaseInSysViews` are dropped, as
    `sync/schemaAssets.ts` already documents. Runtime stats needed three small core additions —
    `PgClass.reltuples`, `PostgresFunctions.pg_total_relation_size`, and `sys.partitions` /
    `sys.allocation_units` views (+ `SysIndexes.partitions()`); the SQL Server read joins them IN MEMORY
    rather than leaning on a two-level correlated `SUM`.
  - **no `useExpand()`**: altea has no Expander, and the app shell's wrapper is `display: block`, so a
    `flexGrow` chain resolves to a 0-height box and `useSize` never reports a size — the graph container
    carries an explicit `MAP_MIN_HEIGHT` (`75vh`) instead, the shape altea-chart's `ReactChart` uses.
  - the colour-provider registry lives on `AppContext.clientState`, so Signum's `clearProviders` /
    `clearSettingsActions` pair has no counterpart; each provider factory is registered ONCE per
    dropdown entry, and the page throws if the server's list and the client's disagree.

- **Signum.TimeMachine → altea-time-machine: the READER of a history that core already keeps.** One route,
  one page, the quick link, two restore helpers. Core gained the real `getTimeMachineIcon` (a stub before —
  the per-line coloured dot IS the "UI differences" tab) and `OperationLogic.registerPreviousLog`. The
  load-bearing part is that **a `@part` row INHERITS its owner's `@systemVersioned`**, the way it already
  inherits the owner's EntityData: without it a sync against a Signum database did not merely show less, it
  SCRIPTED THE EXISTING LINE HISTORY AWAY (`DROP TABLE order_details_history`, `DROP COLUMN sys_period`,
  `DROP TRIGGER versioning_trigger`). Pinned by `eastwind/terminal/probePartVersioning.ts`. eastwind marks
  `OrderEntity` `@systemVersioned` as Southwind does, so **an existing database needs a `terminal sync`**
  before the Time Machine has anything to read. Full ledger:
  **[altea/docs/port/TimeMachine.md](altea/docs/port/TimeMachine.md)**.

- **Signum.Tour → altea-tour: an assembly of core seams plus driver.js.** The engine ports whole (the
  trigger model, the CSS-step discriminator, the editor, the player). Three pieces went into CORE where
  Signum keeps them: `TourTriggerSymbol` + `TourTriggerLogic` (Signum.Basics — so any module can declare a
  trigger without depending on the extension) and `TourButton` / `TourButtonOptions` (the renderer slot
  altea-tour fills). A fourth is NEW in core because Signum has it and altea did not:
  `EntityPack.extension` + `registerEntityPackExtension` (Signum's `EntityPackTS.AddExtension`), which is
  how the frame widget knows whether a tour exists without a round-trip. Divergences:
  - **`MList` → `@part` rows twice over** (steps, and each step's css steps), keeping Signum's
    `CssStepEmbedded` NAME as the AD configurations did; Signum's `WithVirtualMList` needs no counterpart.
  - a "Property" css step points at a **`PropertyRouteEntity`** row, as in Signum (see that bullet), and
    Signum's delete cascade from PropertyRouteEntity is registered here. The SELECTOR it builds still uses
    the route's LAST SEGMENT, because altea re-roots the PropertyRoute at each embedded and a Line's
    `data-property-path` is its own member (the divergence altea-playwright documents).
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

- **Signum.Tree → altea-tree: the route is a STRING, and the depth-first ORDER is computed in memory.**
  Signum types `TreeEntity.Route` as `SqlHierarchyId` — a SQL Server CLR type — and leans on its methods
  and its native ordering. Neither Node SQL driver surfaces hierarchyid and PostgreSQL has no such type, so
  the column is a `varchar` holding hierarchyid's own TEXTUAL form (`/1/`, `/1/3/`, `/1/3.1/` — byte-for-byte
  what `SqlHierarchyId.ToString()` emits, so a database migrated from Signum reads unchanged) and the
  arithmetic moves into `server/TreeRoute.server.ts`: `IsDescendantOf` → an indexed `LIKE 'prefix%'`,
  `GetAncestor(1)` → the `parentRoute` column Signum also stores, `GetReparentedValue` → a prefix swap,
  `GetDescendant(a, b)` → a label strictly between two siblings' (an integer gap if one exists, else a
  DOTTED label — `[3]`,`[4]` → `[3,1]` — which is exactly how hierarchyid keeps the order dense, so a node
  can always be inserted between two adjacent siblings without renumbering). The one operation a string
  genuinely cannot stand in for is `ORDER BY route`: `'/10/' < '/2/'` lexicographically, and a COLLATION may
  order digits and punctuation differently per dialect and locale — so the sort is a label-wise NUMERIC
  comparator in TypeScript. That is affordable because the tree UI only ever loads a bounded set of nodes
  (the expanded ones plus the matches), but it is why the four "find the neighbouring sibling" queries order
  in memory. This is the one part of the port that replaces a database TYPE with code, so it carries its own
  suite (`test/treeRoute.test.ts`, 18 cases, including the density invariant over 25 repeated insertions).
  Other divergences:
  - **`Level` is a stored COLUMN**, where Signum declares it `[Ignore]` + `[ExpressionField]` over
    `Route.GetLevel()`. With no hierarchyid there is no SQL function to compute it, and it is what the tree
    page's default filter ("show me the roots") is — so storing it makes that an indexed integer compare. It
    is maintained in one place, `TreeLogic.setRoute`, which is where Signum's `Route` setter maintained its
    own copy. Consequently only FOUR of Signum's six expressions are registered (`Children` / `Parent` /
    `Descendants` / `Ascendants`); `TreeInfo` is gone too — it existed so the controller could project a
    node's display data through a query token and rebase it onto `Entity.Ascendants.Element.TreeInfo`, and
    the server builds that DTO directly here (no QueryDescription to rebase onto).
  - **each expression is a `withQuoted` prototype member plus a query TWIN**, the asymmetry altea-workflow
    documents: the engine needs `descendants` both in SQL (a filter) and in memory (`fixName` walking a
    subtree), and a `withQuoted` member is query-only.
  - **`DisabledMixin` is not ported** (Signum.Basics has it, altea does not), so the cascade that
    disables/enables a whole subtree is gone and `TreeInfo.disabled` is always false. The field and the
    `tree-disabled` styling stay, so a host that adds such a mixin has somewhere to put it.
  - `route` / `parentRoute` / `fullName` are ENGINE-maintained, so their validators are
    `disabled: env => env !== "Saving"` — a new node reaches the server with all three empty and the Save
    operation fills them. Signum says the same thing per field (`[NotNullValidator(Disabled = true)]`,
    `DisabledInModelBinder`, `[InTypeScript(false)]` on Route).
  - `TreeClient.configure(ti)` is Signum's four opt-ins in one call, and `hideSiblingsAndIsDisabled` becomes
    `hideTreeInternals` — which needed a core seam: `FieldInfo.notVisible` (Signum's `MemberInfo.notVisible`),
    honoured by `AutoComponent` and `EntityTable`'s default columns.
  - the app supplies the tree TYPE. Southwind uses no tree, so eastwind's `departments/DepartmentEntity` is
    the demo — a module cannot ship a tree type, and without one the pages, the omnibox suggestion and the
    dashboard part are all unreachable.
  It surfaced four CORE bugs, all of them latent long before this module: a registered expression on the
  query's OWN type was invisible in every token picker (the root branch of `TokenCompleter.getSubTokens`
  called the purely local `subTokens`, skipping the server merge — so `Order.TotalPrice`, `SystemValidFrom`
  and the alert/case tokens were all unreachable while the same expression on a nested token showed fine);
  `Finder.TokenCompleter.get("")` threw on the ROOT entity token although `resolveToken("")` handled it;
  `/api/operation/{execute,delete}Multiple` wrote its NDJSON with `JSON.stringify`, which drops a Lite's
  constructor-valued `entityType`, so every SINGLE-lite contextual operation died in the client reader; and
  `EnumLine` labelled its options with the raw member name instead of `Enum.niceName` ("FirstNode", not
  "First node"). One more is Signum's own and is fixed rather than mirrored: the viewer cached the selected
  node's CONTEXTUAL menu items and reloaded them only when unset, so picking a second node and reopening the
  "Selected" dropdown ran the FIRST node's operations — which deletes the wrong subtree.

- **`FileEntity` — the shared, own-row file — completes altea's file model; `FilePathEntity` still does
  not exist.** Signum offers four shapes along two axes (bytes in the row vs. in a store × embedded vs. its
  own row); altea had the two embedded ones. `FileEntity` is `FileEmbedded`'s contents in a table of its
  own, and that is its ONLY reason to exist: several owners may reference one file, and the file can outlive
  any one of them (Signum's `EntityKind.SharedPart`). `FilePathEntity` — the store-backed sibling — is
  still unported: nothing needs that combination, and it would want FilePathEmbeddedLogic's whole
  save/delete cascade a second time, addressed by row rather than by owner. Divergences:
  - **`ImmutableEntity` IS the base, as in Signum, and only its SETTER half is missing.**
    `altea/data/immutableEntity` is Signum's `Entities/Patterns/ImmutableEntity.cs`, in the layer Signum
    keeps it in. Of its two halves only one is a rule: `PreSaving` throwing when `Modified ==
    ModifiedState.SelfModified`, and altea has that state exactly (`isModifiedSelf()`), so it ports one for
    one. The other — the property `Set` interception, which SILENTLY SWALLOWS a write to a saved row — has
    no seam here (altea entities are plain field bags) and is the worse half anyway: the caller believes it
    changed something and finds out somewhere else. Re-saving an UNCHANGED file still works, which it must
    (the owner's save walks the whole reachable graph): the hash handler recomputes the same value, and a
    value-equal write leaves the snapshot diff clean.
    This bullet used to record the base as declined "but its guarantee is ported" — `FileLogic` hung the
    rule on `preSaving` by hand. The guarantee was right; declining the base was not, and it cost a
    PROPERTY ROUTE a Signum database has: `AllowChange` is a public property of that base, so a legacy sync
    offered to remove `File.AllowChange` and, through the PropertyRouteEntity cascade, the property rule
    pointing at it.
    - **`SchemaBuilder.include` registers the check for every included subclass**, so a type gets it by
      DERIVING as it does in Signum rather than by remembering to hang a handler — the one place that sees
      every included type, and altea's answer to an entity-level `PreSaving` (the accommodation
      altea-workflow's header records). It runs BEFORE whatever the type's own module pushes, which
      changes nothing: it reads the change DIFF, and a handler recomputing a derived value from unchanged
      inputs (FileEntity's hash) writes the same value back either way.
    - **`allowChange` is a FIELD where Signum's is a computed property** over an `[Ignore]` backing field —
      altea has no property getters in the entity model, so Signum's `IsNew` term is written at the single
      place that asks. It is `@column(false)`: a route, not a column, and outside change tracking, so
      ALLOWING a change is not itself one. Being a route means being serialized (route generation skips
      `@serialize(false)` members), so it rides the wire exactly as Signum's `AllowChange` does.
    - **the process-wide `Disable()` is NOT ported** — a `Statics.ThreadVariable`, and this layer is
      isomorphic while a module-level flag on a server would be shared by every concurrent request (the
      race `Connector.CurrentLogger` documents). Nothing is given up: all three of Signum's own callers are
      per-INSTANCE, and the per-instance `AllowChanges()` scope IS ported.
  - the C# `BinaryFile` setter becomes a `preSaving` handler: the hash follows the bytes ALWAYS (computed
    server-side — the isomorphic layer has no crypto). The immutability check is the base's, above.
  - **the download route is addressed by the file's OWN id** (`/api/files/downloadFile/:fileId`, Signum's
    same route), not through an owner as both embedded shapes are: it IS a row, and it may have several
    owners. The gate is therefore FileEntity's own type authorization, which `retrieve` applies like any
    other read — an anonymous caller gets `403 Not authorized to retrieve FileEntity`, so ids cannot be
    guessed into bytes. Its stored hash is the ETag, so revalidation costs nothing.
  - the client's `kind` discriminator (threaded through FileLine / MultiFileLine / FileUploader /
    FileDownloader) grows a third case, and `kind()` became a SWITCH on the bound member's type in both
    lines — not a two-way default, which would send a FileEntity looking for a store it has no need of.
    `FilesClient.fileUrl` accepts a `FileEntity` or a `Lite<FileEntity>` (Signum's `fileUrl` /
    `fileLiteUrl` pair), which is what lets a search-result column offer a download without the bytes.
  - `hash` is declared NON-nullable so the column is `NOT NULL` as Signum's is, with an explicit
    `@notNullValidator({ disabled: env => env !== "Saving" })` replacing the implicit always-on one —
    Signum's `DisabledInModelBinder`, and the shape altea-tree's engine-maintained columns use.
  - NOT ported: the `FileEntity(string path)` constructor (`File.ReadAllBytes` is server-only, this layer
    is isomorphic) and `ToXML` (its one Signum caller is WordTemplate's `SyncFromXml`, and
    @altea/altea-office-template holds a `FileEmbedded` with XML of its own).
  **`EmployeeEntity.photo` uses it**, as Southwind does (`Lite<FileEntity>`), so the column is
  `employee.photo_id` → `files.file(id)` instead of the bytes inline. altea keeps a full reference
  rather than a lite: the column is the same either way, the view renders the photo (so a lite would
  only force the second fetch Southwind makes by hand with `Navigator.useFetchInState`), and altea's
  file LINES do not bind a lite. `CategoryEntity.picture` stays a `FileEmbedded` — so does Southwind's
  `Picture` — and altea-office-template's `template` too. It surfaced one more declared-but-unreachable
  case: `FileImageLine.kind()` was a two-way default, so the `FileEntity` its own props accept was
  handed to the uploader as a `FilePathEmbedded`, looking for a store a row-held file has no need of
  (FileLine's switch already said why). **An existing eastwind database needs a `sync`**, and the
  employee photos are re-loaded from `terminal/image_photos` rather than migrated. Pinned by
  `eastwind/terminal/probeFileEntity.ts` (26 checks) plus a three-case HTTP round-trip; `files.file` needs
  a `sync`, and matches Signum's table column for column. Full ledger:
  **[altea/docs/port/Files.md](altea/docs/port/Files.md)**.

- **A BigString's text lives in a column or in a FILE, decided per PROPERTY ROUTE — and eastwind now
  decides, where it never used to.** `BigStringEmbedded` is a wrapper around one unbounded text column;
  declaring @altea/altea-files' `BigStringMixin` on it hangs a `FilePathEmbedded` alongside, and
  `BigStringLogic` writes the text out on save and reads it back on retrieve, so nothing that reads
  `.text` changes. The machinery was ported with the files module and had simply never been CONFIGURED:
  every route stayed in its column, so `basics.exception` had `stack_trace_text` where a Signum database
  has `stack_trace_file_hash`. `Starter.configureBigString` is Southwind's `ConfigureBigString` —
  `File` for the five log types (Exception / OperationLog / ViewLog / EmailMessage / RestLog), one store
  each. Nothing is registered `Database`, and the reason is worth recording: five routes were, purely to
  stop the mixin giving file columns to fields that had no business being BigStrings at all —
  `PackageEntity` / `PackageOperationEntity.configString`, `ProcessExceptionLineEntity` /
  `SchedulerTaskExceptionLineEntity.elementInfo`, `ScheduledTaskLogEntity.remarks`. Signum declares all
  five a plain `string?`, so they are plain strings here now: five columns lose their `_text` suffix, the
  five registrations go, and a sync's answer to "`remarks` has been renamed?" stops being yes. `Database`
  mode is still what an app picks for a route it wants kept in the row.
  - **a route is named by a SELECTOR, never a string** — `BigStringLogic.register(sb, ExceptionEntity,
    e => e.stackTrace, config)`, which is what Signum's `Expression<Func<T, BigStringEmbedded>>` is.
    The lambda goes through the quote-transformer (`memberPath`, the single-member counterpart of
    `accessedFields`), so it is compiler-checked, follows a rename, and may walk embeddeds. Same
    reasoning made **`overrideImplementedBy`** take one: `overrideImplementedBy(ExceptionEntity,
    e => e.user, () => [UserEntity])`. Both must be written INLINE at the call — that is where the
    transformer stamps the AST.
  - **altea REQUIRES a configuration per route**, listing the missing ones at `schema.initialize()`;
    Signum's `Configurations.GetOrThrow(pr)` only finds out on the first save of that route.
  - **switching an existing database from `Database` to `File` is not just a `sync`** — the sync drops
    the text column. Signum's answer, which altea ports, is to deploy once with
    `Migrating_FromDatabase_ToFile` (both columns exist, every save moves the text across), run
    `BigStringLogic.migrateBigStrings(T)`, then switch. eastwind's dev database was simply re-synced:
    what it lost was its own log text.
  - it found TWO defects in code that had never been exercised, both of which silently LOST text:
    `File` mode wrote nothing on an INSERT (Signum tests `bs.Modified == SelfModified` and a freshly
    constructed ModifiableEntity IS SelfModified there; altea reads an embedded with no baseline as CLEAN,
    so `entity.isNew` is the other half of that question), and `registerAll` skipped every MIXIN
    route — OperationLog's DiffLog dumps, EmailMessage's reception raw content — where Signum's
    `PropertyRoute.GenerateRoutes` walks mixins.
  Pinned by `eastwind/terminal/probeBigString.ts` (11 checks: the column set in both modes, that
  registerAll reaches a mixin's routes, and an INSERT / retrieve / UPDATE round trip through the store).
  Full ledger: **[altea/docs/port/Files.md](altea/docs/port/Files.md)**.

- **`TypeEntity` keeps Signum's `namespace` beside altea's `package`, and the sync CARRIES IT OVER.**
  altea records the owning npm PACKAGE where Signum records the C# NAMESPACE, so a Southwind sync offered
  to rename one into the other — a rename that DROPS a column a Signum database has values in. `namespace`
  is now declared NULLABLE and altea never writes one; `synchronizeTypes` copies the persisted value onto
  the model row before the merge, because `copyRowFields` copies wholesale and would otherwise null out
  every row on the first sync. Signum is gaining `package` from the other side, so the two tables converge.
  - **`tableName` is the SCHEMA-QUALIFIED, escaped name**, as Signum's
    `SimplifyTableName(tab.Name).ToString()` is — `sms.sms_message`, `public."order"`, with the DEFAULT
    schema spelled out (`public` / `dbo`). altea stored the bare name, so every one of a Southwind
    database's ~220 rows read as a different table and the sync offered a rename it would otherwise
    resolve by DELETE + INSERT, which re-ids the type and breaks every @implementedByAll discriminator,
    auth rule and stored Lite pointing at it. Two things had to follow:
    - **the TypeTableName bucket is SEEDED from the table renames**, which is Signum's own
      (`replacements.Add(TypeTableName, replacements.TryGetC(KeyTables).SelectDictionary(...))`) and was
      not ported. A table that MOVED — altea groups tables into per-package schemas, so Signum's
      `queries.filter_operation` is `basics.filter_operation` here — is an already-answered question by
      the time the type step runs; without the seed it is asked a second time, per type. Both sides go
      through the column's own spelling, since `keyTables` holds `ObjectName.toString()`, which omits
      the default schema and escapes nothing.
    - **the reserved-word list SPLIT in two**, Signum's `KeywordsSqlServer` / `KeywordsPostgres` ported
      verbatim. altea had ONE "common" list, which is wrong in both directions: `PUBLIC` is reserved in
      SQL Server and NOT in PostgreSQL, so the default schema came out `"public".employee` where Signum
      writes `public.employee`. Invisible until a qualified name was written into a column and compared
      with a Signum database's.
    Together a Southwind sync went from ~220 type-row DELETE + INSERT pairs to ZERO deletes and 65
    inserts — the types eastwind has and Southwind does not.
  - **a first sync after adding a TypeEntity column cannot read that column**, so `synchronizeTypes` /
    `synchronizeProperties` are commented out of that one script and everything downstream of the type
    cache — the DYNAMIC definitions included — reads as absent. **Do not apply such a script blind**: with
    no dynamic types in the schema it also scripts every dynamic table as a DROP. Run the sync a SECOND
    time and apply that one. (`generateMusicEnvironment` hit the same wall from the other side and now
    wraps its `start()` in `StartParameters.withIgnoredDatabaseMismatches` — generating is exactly the
    case where the database trailing the code is not an error, and without it a TypeEntity change could
    only be regenerated by dropping the test database by hand.)
- **`@legacyColumnName` — the field-level sibling of `@legacyTableName`, and the seam that keeps a model
  difference from being reshaped into a column name.** `RuleOperationEntity` is the case it was written
  for: Signum keys an operation rule by an embedded PAIR (`OperationTypeEmbedded Resource`), so its columns
  are `ResourceOperationID` / `ResourceTypeID`; altea keeps two direct FK fields, which is simpler
  everywhere the rule is read and indexed. Introducing the embedded to match reached the same Southwind
  parity — 600 statements either way — through the whole module (the entity, the unique index, six
  OperationAuthLogic sites, both test seeds), for a difference a database can only see as two column names.
  So the columns are named instead: `@legacyColumnName("ResourceOperationID")`, ignored when legacy mode is
  off. Unlike `@column({ columnName })` — which is VERBATIM, because a hand-picked name is not altea's to
  re-spell — a legacy name is a SIGNUM name, and mapping one of those to the dialect is exactly what
  `idiomatic` is: so it still goes through it, and one declaration is right on both dialects
  (`resource_type_id` / `ResourceTypeID`) where a verbatim name could only ever be right on one. Write the
  whole logical name, `ID` suffix included; only for a field owning exactly ONE column (a value, a
  reference or an enum — an embedded's name is a PREFIX, and a polymorphic reference owns one column per
  implementation, which is refused outright). Aligned beside it, and a real model fix rather than a
  spelling: all three `Rule*ConditionEntity_Condition` rows gained the `@rowOrder` Signum's
  `[PreserveOrder]` gives them.
  It is also what lets a justified FIELD rename stop being a database difference.
  `ConcurrentUserEntity.SignalRConnectionID` is `connectionID` here for a good reason — altea has no
  SignalR, so naming a column after a transport it does not use would be actively misleading, and the
  client DTO already said `connectionID` — but a Signum database cannot see that reasoning, only a
  column it is asked to rename. `@legacyColumnName("SignalRConnectionID")` keeps both: altea's name in
  the model and in normal mode, Signum's in the database. The plain index follows the column, so it
  matches too (492 → 487 statements).
  The **Word → Office** rename is the same case one layer down. altea-office-template already declared
  `@legacyTableName("WordTemplate")` and friends, but the rename reaches the COLUMNS too —
  `officeTransformer` / `officeConverter` on the template, `officeTemplate` on the attachment — and a
  database can only see those as renames. Three `@legacyColumnName`s (322 → 310 statements). And the
  last difference on that table was a real MODEL one rather than a spelling: `template` was a
  `FileEmbedded` (bytes in the row) where Signum keeps a `Template_ID` FK. That had been forced while
  altea-files had only the embedded forms; FileEntity is ported now, so it is a REFERENCE and
  `word.word_template` matches column for column (310 → 303). altea keeps a FULL reference where Signum
  declares a LITE, the call `EmployeeEntity.photo` already makes: the column is the same, every reader
  needs the bytes, and altea's file LINES cannot bind a lite. It brings Signum's **superseded-file dance**
  with it — a FileEntity is IMMUTABLE, so replacing a template's document makes a NEW row and the Save
  operation schedules the old one's delete on `Transaction.preRealCommit` (deferred, because the template
  still points at it until the save commits); the read projects the ID alone, since selecting a full
  reference would drag the whole document back. **An existing altea database needs
  `eastwind/terminal/migrateOfficeTemplateFile.ts` BEFORE the sync** — otherwise it adds `template_id`
  and drops `template_binary_file` in one script, and every template keeps its name, filters and tokens
  while losing the DOCUMENT. The migration computes the file's hash the way `calculateMD5Hash` does
  (base64 of the MD5, via Postgres' own `md5()` and a decode/encode pair — no pgcrypto), because that
  hash is the file's cache identity: it rides the download url and becomes the ETag.

- **An `@implementedByAll` is a LAST resort, and its id columns are the APP's choice.** Signum types a
  polymorphic reference against an INTERFACE (`IProcessDataEntity`, `Lite<IEntity>`) and its schema builder
  gives one column per implementor IN THE SCHEMA — `Data_ID_Package`, `Data_ID_EmailPackage`, … altea has
  no runtime interface, so three references had reached for `@implementedByAll` instead, which is not the
  same thing at all: it costs one id column PER CONFIGURED PK TYPE plus a type discriminator, and it lets
  the row point at anything rather than at the types that implement the contract. They are
  `@implementedBy(() => [])` now, widened by the app — the `ChangeLogViewLogEntity.user` accommodation:
  `ProcessEntity.data` (five implementors, exactly Southwind's) and `ProcessExceptionLineEntity.line`
  (one). A third was not polymorphic at all: `PackageLineEntity.package` was a plain
  `Lite<PackageEntity>`, one FK to `processes.package` — so a line of a `PackageOperationEntity`, which is
  a SUBCLASS with a table of its own, could not be stored. Signum gives a reference to a type with concrete
  subclasses one column per table; those two are declared in the module, since both types are its own.
  - **`implementedByAllPrimaryKeyTypes` defaults to Signum's `{int}`**, and an app ADDS what its model
    needs (`sb.settings.implementedByAllPkType("uuid")` — Southwind's
    `ImplementedByAllPrimaryKeyTypes.Add(typeof(Guid))`; eastwind needs it for the thirteen uuid-keyed
    user-asset rows, and the framework's own test schema asks for `long` and `uuid` because the music model
    exercises all three). It used to default to all three, which put a dead `_Int64` column on every one of
    ~150 `@implementedByAll` fields in a workspace where nothing declares a `long` key — the cost of an
    unused entry is a column per field, so the list belongs to whoever knows the model.
  Together: a Southwind sync went 590 → 557 statements. **An existing altea database needs a `sync`** (the
  `_Int64` columns everywhere, and the three references reshaped); eastwind's three process tables were
  empty.
  - **An `@implementedByAll` is INDEXED PER ID COLUMN, and a UNIQUE index over one is EXPANDED.** A
    polymorphic reference is several columns with exactly ONE filled per row, so a single index over all
    of them is the wrong index twice over: a lookup by (type, id) cannot use a composite whose leading
    columns belong to the other pk types, and a UNIQUE constraint over the lot compares every row equal on
    the columns it leaves NULL — which on SQL Server, where NULLs compare EQUAL in a unique index,
    constrains something nobody asked for. Signum answers with two rules altea now ports one for one:
    `FieldImplementedByAll.GenerateIndexes` emits one `(TypeID, ID_<pkType>)` index per id column, and
    `SchemaBuilder.AddMultiUniqueIndex` expands a composite UNIQUE index into the CARTESIAN PRODUCT of
    each polymorphic block's alternatives — one PARTIAL index per combination, filtered to the rows that
    use it. The filter rule applies to ordinary columns too: a nullable one contributes
    `IS NOT NULL` (a string also excludes `''`), so a row with a NULL in a covered column takes no part
    in the uniqueness. `multiUniqueIndexes` (server/schema/tableIndex) is that recursion, shared by the
    class-level `@uniqueIndex` and the fluent `withUniqueIndex`; a NON-unique composite index stays
    flat, as Signum's `AddIndex` is. The names come out identical to a Signum database's, hash and all
    (`ix_concurrent_user_target_entity_id_type_targetnrdwyxz`,
    `uix_..._usernxz1qn0__v17s7ez`), which is the check that the WHERE text matches too.
    **An existing altea database needs a `sync`** — eastwind's dev database gained 44 indexes.
    What it does NOT fix is the FK: the discriminator carries one to `basics.type` in Signum and none
    here (altea's comment claimed Signum avoids it; a Southwind database has
    `fk_concurrent_user_target_entity_id_type`, so it does not — but adding it needs the
    `EntityEvents<TypeEntity>.PreDeleteSqlSync` cascades altea-view-log records as unported, or a sync
    that removes a type row fails on the constraint). 17 tables still script that FK drop.
  - **A POLYMORPHIC reference's nullability is the FIELD's, unless there is more than one column.** This
    was the "app-wide nullable-implementedBy divergence" seven tables shared, and it was never a decision
    — just an incomplete rule: altea hardcoded every `@implementedBy` column and both halves of an
    `@implementedByAll` to nullable, with one special case for a `@backReference`. Signum's two
    generators say it in one line each. `GenerateFieldImplementedBy`:
    `if (types.Count() > 1 && nullable == No) nullable = Forced` — several columns of which ONE is
    filled must be nullable in the database while the field stays required in the model, but a SINGLE
    implementation owns one column and takes the field's own nullability. That generalises altea's
    back-reference case to every accommodation where a framework type declares
    `@implementedBy(() => [])` for the app to widen (`VisualTipConsumedEntity.user` and six
    siblings, `NOT NULL` in Signum too). `GenerateFieldImplementedByAll`: the DISCRIMINATOR carries the
    field's own nullability — exactly one is written per row — while an id column is nullable as soon as
    the schema configures SEVERAL pk types. **A Southwind sync went 485 → 391 statements**, because the
    discriminator ALTER was also what forced the sync to drop and recreate the per-id indexes above;
    `concurrent_user` now scripts ONE line, the FK. **An existing altea database needs a `sync`**, and
    it contains `SET NOT NULL` — check those columns hold no NULLs first (eastwind's dev database:
    20 columns, none). Signum's `[ForceNullable]` is `@forceNullable` for a field that must be
    required in the model and nullable in the row — the framework fixture's
    `NoteWithDateEntity.target` needs it, as Signum's does, or the UnsafeUpdate suite cannot set it to
    null.
  - the framework suite's schema asks for all three pk types in `MusicLogic.start`, with the MODEL, not
    in `MusicStarter` — which the suites' own `setup.ts` does not go through, so the two extra id
    columns were never built and no test had ever seen a multi-column `@implementedByAll`.
    **That suite's database needs regenerating** (`pnpm --filter @altea/altea gen:postgres`).

- **A `@valueField` is ONE HOP, and all three surfaces make it.** Signum's `MList<string>` element IS the
  value, so its token ends at `Telephones.Any`; altea's element is a `@part` ROW whose `@valueField` holds
  the value, so the same thing is `Telephones.Any.Telephone`.
  - **`QueryTokenString`** takes an optional lambda on `any` / `all` / `notAny` / `notAll` / `element`, so
    `token(a => a.telephones).any().append(a => a.telephone)` and `…any(a => a.telephone)` are one token.
    There is no third spelling: the typed builder never produces the bare quantifier as a VALUE, because
    that token is the row.
  - **LEGACY MODE reads Signum's** — `appendLegacyValueField` descends into the `@valueField` when a token
    stops at a collection element, applied by `QueryLogic.getToken` and the client's `TokenCompleter`, the
    same two places `stripLegacyRootPrefix` is and the same ONE direction (a token altea writes back stays
    altea's). So `Telephones.Any` and `Entity.Telephones.Any` both resolve; a row with no `@valueField` is
    left exactly where it stopped.
  - **`QueryTokenBuilder` makes the hop for the USER**, in both modes: picking Any / All / Element on such
    a collection selects the value, since the picker would otherwise show a single choice to click every
    time. Only when the selection ENDS there — `tryApplyToken` re-projects the previous tail first, so
    changing a part in the MIDDLE keeps everything after it.
- **`@valueField` marks an EMBEDDED element too, and that is what inlines its members unprefixed.** An
  MList element has no property in Signum, so a legacy-mode MList table names its columns without reference
  to one — and for an EMBEDDED element that means NO prefix at all (`file_name`, not `element_file_name`).
  `legacyMListColumnBase` already had that branch and it was unreachable: `@valueField`'s own contract said
  "non-embedded", so the four rows whose field IS the whole element were never marked. They are now —
  UserChart's columns and parameters (`MList<ChartColumnEmbedded>` / `<ChartParameterEmbedded>`),
  `PredictorEntity.files` and WhatsNew's attachments (both `MList<FilePathEmbedded>`). The test is whether
  the field IS the element: a row that flattens a RICHER embedded's members has no single element field
  (`EmailMessageEntity_Attachment.file` is one member of `EmailAttachmentEmbedded`, and every
  `token: QueryTokenEmbedded` row is one member of a QueryColumn/OrderEmbedded), so those stay unmarked.
  Two more differences fell out of the same tables: **`FilePathEmbedded.suffix` is NOT NULL**, as Signum
  declares it — it is filled by `prepareSuffix` before the row is inserted, so the shape is
  `@notNullValidator({ disabled: env => env !== "Saving" })`, the one `FileEntity.hash` already uses (six
  tables) — and **UserChart's `parameters` lost its `@rowOrder`**, because Signum marks that MList
  `[NoRepeatValidator]` and NOT `[PreserveOrder]`: a parameter is found by name, where a COLUMN is
  positional and keeps its order. Together: 557 → 516 statements.
  The rule then caught one going the OTHER way: `SkillCustomizationEntity_SubSkill.skill` was marked
  although the row flattens BOTH members of Signum's `SubSkillEmbedded` (Skill + Activation), so its
  columns came out `EntityID_SkillCustomization` / `EntityID_SkillCode` — named from the declared type of a
  polymorphic element — where Signum inlines the member under its own name, `Skill_ID_SkillCustomization`.
  Beside it, neither of SkillCustomization's two MLists is `[PreserveOrder]` (only ChatMessage's ToolCalls
  is, in that whole module), so both rows lost the `@rowOrder` altea had given them and the two tables now
  script NOTHING: 516 → 500.
  The same naming rule reads the DECLARED type of a polymorphic element, so narrowing one is a database
  difference: both `CustomDrilldowns` rows declared `drilldown: Lite<UserQueryEntity>` where Signum
  declares `[ImplementedBy(typeof(UserQueryEntity))] MList<Lite<Entity>>` — the implementation supplies
  only the column's SUFFIX, so Signum's is `Entity_ID_UserQuery` and altea's came out
  `UserQueryID_UserQuery`. They are `Lite<Entity>` now, which is also the truer contract (a drilldown
  target is open; the implementations list is the only thing narrowing it), and both tables script
  nothing: 391 → 377. Signum's `[NoRepeatValidator]` on those two collections was missing too — a
  validator, so no column moves. **An existing altea database needs a `sync`.**
  One field had been typed with the string UNION rather than the enum, which the transformer sees as a
  plain string: `ChartColumnEmbedded.orderByType` was `OrderTypeKeys | null`, so its column was a
  varchar `OrderByType` where Signum's `OrderType? OrderByType` is an FK to the enum table,
  `OrderByTypeID`. It is `OrderType | null` now (373 statements), which moves the field's runtime
  value from the NAME to the ORDINAL — so every comparison goes through `OrderType.Ascending` and every
  crossing into a DTO (a ChartColumnOption, the url's `A`/`D`, the XML attribute, an OrderRequest)
  through `Enum.toName` / `toEnum`. **An existing altea database needs
  `eastwind/terminal/migrateChartOrderByType.ts` BEFORE the sync**: the sync adds the FK column and
  drops the varchar in one script, so every SORTED chart column silently loses its direction and the
  chart then renders in the query's own order with no error anywhere.

- **Token migrations: the renames a schema sync resolves are replayed against the query TOKENS stored
  inside user assets.** A UserQuery / UserChart / template keeps its tokens as STRINGS, so renaming a
  field or a query breaks every stored token that walked through it — and nothing in the schema sync
  notices, because those tokens are DATA. Signum.UserAssets' TokenMigrations answers that by recording
  each decision into a versioned `.tokens.json` beside the SQL migrations and replaying it;
  `altea-user-assets/{data/TokenMigration, server/TokenMigration{File,Logic,Runner}, server/TokenSyncContext,
  server/QueryTokenSynchronizer, server/TokenSyncWalker}` is that, with a subscriber in each of the four
  modules that own stored tokens. Two MODES, asymmetric on purpose: **Record** is interactive and saves
  nothing (it asks about each unresolvable token and writes the answers to a file), **Apply** is silent
  and saves per entity (it replays them, and a miss is an ERROR rather than a question — it runs where
  nobody is watching).
  - **the JSON is a CONTRACT**, not an implementation detail: a file written by either framework is read
    by both — which is the whole point for an app migrating between them. Pinned by a round-trip check.
  - **ONE walker where Signum has four**, because every stored filter / column / order row is a `@part`
    row over a shared `QueryFilterBaseEntity` rather than an EmbeddedEntity inside four unrelated MLists.
    The columns/orders are passed as accessor SLOTS rather than a shape, because a chart wraps its token
    one level down in `element`.
  - **a chart column is CLEARED, not removed.** A chart's columns are POSITIONAL — the script binds column
    0, 1, 2 — so dropping one would re-bind every column after it to the wrong role. Signum removes the
    row; altea nulls the token and leaves the slot, which the chart editor already renders.
  - the three hooks that put this in the ordinary workflow are wired by the APP, not the module
    (`altea-user-assets` must not depend on `altea-migrations`): `afterMigrationsCompleted` →
    `tokenMigrations`, `afterCreatingMigration` → `afterMigrationCreated` (drains a sync's QUERY renames
    into a sibling `.query.json`, so they are on disk before the old names are gone), and the NEW core
    seam `Administrator.afterSynchronize` → `afterSynchronize`. Core also gained four Colors
    (magenta / darkYellow / blue / cyan) that Signum's pickers distinguish outcomes with.
  **NOT ported, and it is a real limit:** the pass over a template's BODY TEXT, where `@[Customer.Name]`
  lives — Signum's `TemplateSynchronizationContext` plus a `Synchronize` on every value provider, which
  is what the `Member` / `Global` buckets are for. The two template subscribers repair a template's
  stored QUERY tokens (filters, orders, the From token); a renamed token inside the body still surfaces as
  a parse error when the template renders. altea-templating's header used to say that pass was impossible
  because altea had no TokenMigrations; that premise is now false and its comment says so, so the follow-up
  has its prerequisites in place. Pinned by `eastwind/terminal/probeTokenMigration.ts` (23 checks: the
  file contract, a rename CHAIN across two files — and that half a chain does NOT resolve — the
  multi-candidate branch, era-subkey unwinding, that Apply refuses to guess, and an end-to-end repair of
  a stored UserQuery). `user_assets.token_migration` needs a `sync` and matches Signum's table column
  for column. Full ledger: **[altea/docs/port/UserAssets.md](altea/docs/port/UserAssets.md)**.

- **SystemEventLog is in CORE, and its "stop" hook is platform-shaped.** `altea/data/systemEventLog` +
  `server/systemEventLogLogic` + `server/systemEventServer`, where Signum keeps them (Signum/Basics): a
  line per PROCESS event, so the table answers "was the server even up then?". Two properties are the
  whole design and both are Signum's — the row is written in its OWN transaction
  (`Transaction.forceNew`), because the events worth recording happen while something else is going
  wrong and a row that rolls back with the ambient transaction records nothing about exactly that moment;
  and `log` NEVER throws, reporting a failure through ExceptionLogic and answering `false`, because
  failing a boot because the boot could not be logged would be worse than not logging it. Divergences:
  - **`IHostApplicationLifetime.ApplicationStopping` becomes process SIGNALS plus `beforeExit`, and the
    coverage is per-PLATFORM rather than uniform.** Windows has no POSIX signals: Node emulates
    SIGINT / SIGBREAK for a real console Ctrl+C / Ctrl+Break, and **SIGTERM does not exist there at all** —
    a `taskkill`, a service stop, or another process's `process.kill(pid, "SIGTERM")` terminates the
    target outright with no handler run. Found the hard way: the first version registered SIGTERM
    everywhere, and a self-kill on Windows produced no handler and no row. So `stopSignals` is chosen by
    `process.platform`, and a missing "Application Stop" means "this process did not shut down through a
    route we can observe" — usable information, as long as the routes are written down, which is what the
    module header does.
  - **the handler exits with `128 + signal number`, it does not re-raise.** A self-`process.kill` is not
    portable (same reason), and this yields the status a shell reports for a signal death on either
    platform. Not `exit(0)`, which would file a `kill` as a clean shutdown.
  - **the `stopping` guard is load-bearing against `beforeExit`, not just against a second signal.**
    `beforeExit` fires whenever the loop drains, and scheduling async work inside it — which writing a row
    is — keeps the loop alive, so it drains and fires AGAIN, forever. Verified: an async `beforeExit`
    handler without the guard re-entered until killed.
  - `Schema.Current.MachineName` → `node:os`'s `hostname()`, which ExceptionLogic already uses for the
    same column; `ExceptionLogic.DeleteLogs` is not ported (the note every log-owning module carries),
    and note Signum registers TWO limits there — plain rows and rows WITH an exception — so a port of that
    machinery must keep both.
  Pinned by `eastwind/terminal/probeSystemEventLog.ts` (15 checks, including that a row written inside a
  DOOMED ambient transaction survives its rollback, and that an unsavable event answers false instead of
  throwing). The signal / drain paths are verified out of process instead, since they turn on exit status:
  a drained loop writes exactly one stop row and exits 0, and the SIGINT handler body writes its row and
  exits 130. Windows OS DELIVERY of SIGINT needs a real console Ctrl+C and is not machine-verified here.
  `basics.system_event_log` needs a `sync` and matches Signum's table column for column.

- **SessionLog: who logged in, from where, for how long — and the closing half is WIRED, where Signum's
  is dead code.** `altea-auth/{data/SessionLog, server/SessionLogLogic}`, one row per login, opened on
  `/api/auth/login` and closed on `/api/auth/logout`. The app starts it (Southwind's
  `SessionLogLogic.Start(sb)`). Divergences:
  - **`SessionLogLogic.SessionEnd` is never called in Signum** — not by the framework, not by Southwind —
    so every row it writes keeps `sessionEnd` null, `sessionTimeOut` false and its `Duration` expression
    null forever: three of the entity's six fields, its one expression and two of its five default query
    columns are inert there. altea has the hook Signum lacks a call from, `AuthServer.userLoggingOut`, so
    the port keeps the method and adds the missing call — the same decision altea-help made for Signum's
    unreachable `HelpSearch`. Verified end to end over HTTP: a login opens the row, a logout closes it,
    and `durationSeconds` comes back 13.
  - **the "latest session" ordering gains a tie-break on `id`.** Signum narrows with
    `.OrderByDescending(SessionStart).Take(1).Where(SessionEnd == null)` — "the latest row, and only if it
    is still open", deliberately not "the latest open row", which is kept exactly. But `sessionStart` is
    truncated to SECONDS, so two logins in the same second are indistinguishable by it and the single-key
    ordering picks between them arbitrarily. Observed while probing: the second session was left
    permanently open because the tie resolved to the first, already-closed row. Within one second the
    higher id IS the later row.
  - **which roles are recorded defaults the way round that is worth knowing.** The gate is an
    authorization CHECK, not an explicit grant: a role with no rule for `SessionLogPermission.TrackSession`
    inherits the role's own default (Signum's `GetAllowedBase`), so an unrestricted role IS tracked as
    soon as the module starts, and it is a restricted role that must be granted the permission to appear.
    To record nobody, deny the permission — or do not start the module.
  - `PermissionLogic.RegisterPermissions` has no counterpart (a declared `init()` symbol is picked up by
    the symbol synchronizer), which makes `isAuthorizedForRole` — and hence `sessionStart` /
    `sessionEnd` — ASYNC; `[DateTimePrecisionValidator(Seconds)]` has none either, so both dates are
    truncated where they are assigned (the call altea-sms already made); the ORDER BY + TOP `UnsafeUpdate`
    becomes select-then-update-by-id (as UserTicketLogic's per-user sweep does); `ExceptionLogic.DeleteLogs`
    is not ported, the note every log-owning module carries.
  Pinned by `eastwind/terminal/probeSessionLog.ts` (23 checks, including that the nullable-ternary
  `durationSeconds` really lowers to SQL both as a projection and as an ORDER BY). `auth.session_log`
  needs a `sync` and matches Signum's table column for column. **A new declared symbol means each test
  suite's own database needs regenerating** — the auth suite failed 27 of 30 with "Mismatches caching
  PermissionSymbol: Missing SessionLogPermission.TrackSession" until `pnpm --filter @altea/altea-auth
  gen:postgres`.

- **UserTicket ("remember me") is in altea-auth, and its cookie is HttpOnly.** Signum keeps it in
  `Signum.Authorization/UserTicket/`, and so does altea (`data/UserTicket` +
  `server/UserTicket{Logic,Server}`): one row per remembered device holding a random secret, exchanged
  for a normal auth token at boot. The app opts in — `UserTicketLogic.start(sb)` in the Starter, plus
  `startPublic(routes, { userTicket: true })` and `registerUserTicketAuthenticator()` in MainPublic — which
  is exactly Southwind's wiring, and what makes the "Remember me" checkbox appear at all. Divergences:
  - **the cookie is `HttpOnly` + `SameSite=Lax` (+ `Secure` over https), where Signum's is script-readable.**
    Signum leaves it readable only so its client can call `Cookies.get("sfUser")` and skip a pointless
    `loginFromCookie` when there is no cookie; the price is a 60-day credential exposed to any XSS.
    altea pays the one POST per anonymous boot instead, so Signum's `Options.getCookie` / `removeCookie`
    pair has NO counterpart — the endpoint answers null for "no cookie" and for "dead cookie" alike, and
    the SERVER clears it in that same response (which is where Signum's own `RemoveCookie` already was).
  - **`device` stores the User-Agent, not an IP.** Signum records `RemoteIpAddress` on the way in but
    `LocalIpAddress` on the way out — the SERVER's own address — so every ticket it issues on the login
    path records the same string, which cannot be what a column called Device is for.
  - `ref string ticket` → `updateTicket` RETURNS the rotated ticket beside the user; `PrimaryKey.Parse` →
    `UserEntity.parseId` (so the user table's declared PK type is respected, not assumed int); the parse
    regex is non-greedy on the id half, where Signum's greedy `(?<id>.*)|` would mis-split a secret
    containing a `|`.
  - **`UserGraph.OnDeactivated` becomes one slot, `AuthLogic.onRemoveUserTickets`.** Signum reaches
    UserTicket two ways from the same graph — the event for `Deactivate`, a direct
    `UserTicketLogic.RemoveTickets` inside `AutoDeactivate` — and altea's user state machine lives in
    AuthLogic, so both operations call one slot the module fills. (Signum also resets its
    `RecentlyUsersDisabled` GlobalLazy there; altea has no such cache — it is an auth-TOKEN concern.)
  - the "too many tickets" sweep is Signum's `.OrderByDescending(…).Skip(Max).UnsafeDelete()`, i.e. a
    DELETE whose row set is an ORDER BY + OFFSET. altea's bulk-DML terminal has no such form, so the ids
    are selected first and deleted by id — over a set bounded by `maxTicketsPerUser`.
  One Signum behaviour is MIRRORED rather than fixed, and is verified as such: `updateTicket` leaves the
  SPENT row in place, so a presented ticket keeps working until a sweep removes it, and
  `maxTicketsPerUser` caps remembered LOGINS rather than devices. True single-use rotation would buy
  little — a thief who uses a stolen cookie is handed a fresh ticket either way, so the credential's real
  lifetime is `expirationInterval` regardless — and would cost robustness: a response lost in flight
  would leave the browser holding a dead cookie. Two gaps it filled on the way: the login form's
  **"Remember me" checkbox was never rendered** (the ref existed, so `rememberMe` was always `undefined`),
  and `/api/auth/loginFromCookie` did not exist. Pinned by `eastwind/terminal/probeUserTicket.ts` (21
  checks) plus a seven-case HTTP round-trip; `auth.user_ticket` needs a `sync`, and matches Signum's
  table column for column (a Southwind sync scripts nothing for it).

- **Signum.Rest → altea-rest: an MVC action filter becomes EXPRESS MIDDLEWARE** mounted on a path prefix
  (`ws.app.use("/api/catalog", RestLogFilter.middleware({ name: "CatalogApi" }))`), and an `?apiKey=` is
  REDACTED in the logged query string where Signum stores it verbatim. It needed one core seam
  (`AuthRequestLike.query(name)`) and fixed one latent core bug (`Duration.total({ unit })` did not
  translate to SQL, only the bare-string `total("ms")` form did — so the object form every duration helper
  in the workspace is written in failed at query time). Full ledger:
  **[altea/docs/port/Rest.md](altea/docs/port/Rest.md)**.

- **Signum.ViewLog → altea-view-log: the module IS three subscriptions**, and it forced three core seams —
  `ExecutionMode.onApiRetrieved`, `DynamicQueryContainer.queryExecuted` and `Connector.withSqlCapture` (an
  ASYNC-LOCAL SQL sink, where Signum swaps the process-wide `CurrentLogger`, which is racy on a server
  running concurrent work). It also surfaced a core gap since FIXED: an `@implementedByAll` lite came back
  with no display string, so the Target column of every operation-log and view-log row rendered blank — the
  Retriever now resolves it as Signum's `IRetriever.RequestLite` does, one lite PROJECTION per type with the
  CALLER's rights. Full ledger:
  **[altea/docs/port/ViewLog.md](altea/docs/port/ViewLog.md)**.

> `old/CLAUDE.md` and `old/**/AGENTS.md` describe **Signum's** conventions, not altea's — read them to understand the source, but altea's conventions above win.

- **Signum.Processes' PackageLogic IS ported, and eastwind's Orders tasks are Southwind's again.** A
  PACKAGE is a row plus one `PackageLineEntity` per element, and an algorithm walks the lines stamping
  `finishTime` — so a run that dies halfway is resumable (`Lines().Where(a => a.FinishTime == null)`,
  kept verbatim). This reverses a recorded non-port: `PackageExecuteAlgorithm<T>` was listed as declined
  because altea-workflow's timeout process walks its own lines, which is true and is why THAT module needs
  none of it — but Southwind's Orders domain is built on it, so eastwind had invented different scheduled
  tasks (`CheckPendingOrders` / `ReviewPendingOrders`, which count unshipped orders and change nothing)
  where Southwind cancels orders older than a week. A Southwind database read that as four symbols removed
  and four added, across `simple_task`, `process_algorithm` and `operation` — and a RENAME would have been
  worse than a drop, since it would point a configured schedule at different behaviour.
  - eastwind now has Southwind's pair, which is the same job done two ways and is the point of having
    both: `CancelOldOrdersWithProcess` packages the stale orders and runs `OrderProcess.CancelOrders` (a
    `PackageExecuteAlgorithm<OrderEntity>` over `OrderOperation.Cancel`), `CancelOldOrders` does it as ONE
    `executeUpdate` with no process and no per-order log. `OrderOperation.CancelWithProcess` comes with
    them — it constructs a PROCESS, not an order, so it hangs off `sb.include(ProcessEntity)
    .withConstructFromMany(OrderEntity, …)` rather than the order's own state machine.
    `CancelOrderAlgorithm` needs no subclass here: Signum's overrides `Execute` only to call
    `base.Execute`, with a "// Override if necessary" comment beside it.
  - **it found THREE core defects, each older than the module and each silent** — together why a package
    process could run to Finished having done nothing, since `ExecutingProcess.forEach` files a per-line
    failure as a row rather than failing the run: `QueryBinder.assign` recursed instead of calling
    `adaptAssign` (so every set-based write into a polymorphic lite column died on "Cannot assign"),
    `Retriever.liteImplementedByAll` kept the coalesced id AS READ (an int came back as the STRING
    `"11128"`, so `retrieve` answered "not found" for a row that is right there), and the OPERATION
    registry was keyed by the symbol OBJECT rather than by `symbol.key` — so an operation named by DATA,
    which is exactly what a `PackageOperationEntity` names, was "not registered".
  **An existing altea database needs a `sync`** (four symbol rows move). Pinned by
  `eastwind/terminal/probePackageLogic.ts` (20 checks), which RUNS things rather than inspecting
  registration. Full ledger: **[altea/docs/port/Processes.md](altea/docs/port/Processes.md)**.

- **Signum.SMS → altea-sms: a small sibling of altea-email, plus the GSM alphabet.** The module is a
  TEMPLATE (per-culture text authored against a query and/or a code-declared model), a MESSAGE, two PACKAGES
  a batch process walks, and a PROVIDER seam. Almost every structural decision is inherited from
  @altea/altea-email, which ports the same template + model-registry + message shape: `MList` → `@part` rows,
  the model registry keyed by CLEAN TYPE NAME and maintained through `Schema.Generating` /
  `Schema.Synchronizing` (so a renamed model class keeps its row, and the FK every template holds), the
  `SMSModel<T>` abstract base becoming an interface plus an `smsModel(...)` defaults factory, and the query
  executed through `QueryLogic.queries.executeQueryAsync` with hand-built Columns / Filters / Orders because
  there is no QueryDescription to thread. What is specific to this module:
  - **`SMSCharacters` is the one piece worth its own suite** (`test/smsCharacters.test.ts`, 13 cases). The
    GSM 03.38 rules are not intuitive — 160 basic characters, seven of them escaped and costing two, and ONE
    character outside the alphabet re-prices the WHOLE message as UCS-2 — and a wrong answer silently
    TRUNCATES a message (`messageLengthExceeded: TextPruning` cuts to whatever it returns). Two divergences:
    the tables are SETS of code points (Signum maps each character to its own code point and only ever tests
    presence), and the UCS-2 budget is **70**, not Signum's `maxLength = 60`, which is neither the
    single-part nor the concatenated figure. Counting iterates by CODE POINT, so an emoji costs one unit and
    correctly forces UCS-2.
  - **`SMSOwnerData` is a plain interface, and the object projection LOWERS TO SQL.** Signum makes it a
    `DescriptionOptions` POCO; altea needs no reflected type, because a `@quoted` member returning a
    hand-built object (`{ owner: this.toLite(), telephoneNumber: this.phone, culture: null }`) is a real
    query token — verified on eastwind's `CustomerEntity.smsOwnerData()`. That is what a template's `to`
    points at. It still has to be REGISTERED as an expression (`@quoted` alone is not a token) — ONCE, on
    the abstract base, since `getExtensionsTokens` walks the parent token's own prototype chain and every
    concrete subclass finds it there. And its `Equals`-based de-duplication becomes a key Set.
  - **`SendAsyncSMS` is dropped** (Signum's detached `Task.Factory.StartNew`): a floating promise in Node is
    an unhandled rejection waiting to happen and races process exit — the Send PROCESS is what
    fire-and-forget means here. Same call altea-view-log made for its log write.
  - **`MultipleTelephoneValidator` / `DateTimePrecisionValidator` have no altea counterparts**: the
    comma-separated form is a `@fieldValidation`, and `sendDate` is truncated where it is assigned.
  - **the two ConstructFromMany operations THROW where Signum returns null.** altea's `construct` must
    return an entity, so "nothing to package" says so instead of silently answering nothing.
  - **`registerSMSOwnerData` is registered ONCE for a hierarchy**, on the abstract base — an operation is
    keyed by its symbol and a subclass inherits its base's. Signum registers per concrete type only because
    C# generics force `Graph<ProcessEntity>.ConstructFromMany<T>` to name one. The projector also retrieves
    through the LITE's own concrete type, since an abstract base has no table.
  - NOT ported: both `ExceptionLogic.DeleteLogs` handlers, `SMSModelEntity`'s `[TicksColumn(false)]` (no such
    option, and the row is only ever written by the synchronizer), the `Retrieved` / `AfterDeserialization`
    token re-parse (altea resolves tokens client-side), and the two package queries' `NumLines` /
    `LastProcess` / `NumErrors` columns — altea-processes exposes neither `LastProcess()` nor
    `ExceptionLines()` as an expression, so each package's VIEW shows its messages in a SearchControl.
  It also surfaced an eastwind gap: **the three background runners had never been started.** Southwind's
  `Program.cs` starts `ProcessRunner` / `ScheduleTaskRunner` / `AsyncEmailSender` 5 s after boot behind a
  `StartBackgroundProcesses` flag; eastwind imported `ScheduleTaskRunner` and never called it, so a
  scheduled task, a queued process and an async e-mail were all created and never run. Started now, web-host
  only — a terminal run must not pick work up.

- **Signum.Markdown → altea-markdown: Markdig becomes mdast**, which is the parser react-markdown already
  is — so this is the one flattener in the workspace that needs no hand-written tokenizer (17-case suite,
  because a substrate swap is where behaviour drifts silently). It filled two gaps outside itself:
  **`htmlToText` was dead code** (Signum's PlainExcelGenerator flattens an Html/Markdown column and altea's
  had no such branch, so a rich-text column exported as raw markup), and **the FontAwesome BRANDS set was
  missing**, so this module's cheat-sheet marker and altea-auth-windowsad's sign-in icon both rendered as an
  empty span. With it ported, altea-agent's SkillCustomization and altea-tour's TourStep use the real
  `MarkdownLine`, as Signum does. Full ledger:
  **[altea/docs/port/Markdown.md](altea/docs/port/Markdown.md)**.

- **Signum.Isolation → altea-isolation: an app-wide commitment, so eastwind does not make it.** Every
  table declares a STRATEGY (`Isolated` / `Optional` / `None`), an isolated table gains an isolation
  column, and a request that has picked one sees only its rows — the filter is a WHERE the LINQ binder
  splices onto every query of that type, so retrieve, dynamic query and navigation are covered by one
  registration. Startup FAILS if any table declared nothing, which is why an app either goes multi-tenant
  or does not install the module; Southwind only REFERENCES Signum.Isolation and never starts it, so
  eastwind wires nothing either and the module's own `test/` suite is the verification (21 DB-free cases +
  18 gated on `ALTEA_ISOLATION_TEST_DB`). Divergences:
  - **the strategy table lives in the DATA layer** (`Isolation.register(T, strategy)`, called from the
    app's shared entity-overrides module), where Signum's `IsolationLogic.Register<T>` is server-only.
    altea INLINES a mixin's fields onto its owner, so the CLIENT has to know a type carries the mixin to
    deserialize `isolation` at all — Signum's client reads a separately serialized mixin bag.
  - **the ambient current-isolation is SCOPE-shaped and lives in `server/`**: an AsyncLocalStorage cannot
    be entered without a callback, and the data layer ships no node types. `IsolationMixin`'s
    `IsRetrieving ? null : Current` initializer goes with it, losing nothing — Signum also stamps in its
    global PreSaving, which is what the port does for every new row.
  - **`[AttachToUniqueIndexes]` / `[ForceNotNullable]` are applied from `start`**, not as decorators (two
    general Signum attributes with one user between them): the unique indexes of every isolated table are
    rewritten on `schemaCompleted` — where Signum applies the first too — and the required rule is a
    `NotNullValidator` pushed onto the route's FieldInfo. That route needs the MIXIN STEP even though the
    column is flat, the accommodation altea-diff-log documents.
  - `EntityEventsGlobal.PreSaving` → a per-type handler on the isolated types only; `IsolationStrategy` →
    a plain string union (never a column, never translated); the MVC `IsolationFilter` → Express
    middleware, as altea-rest's RestLogFilter; the picked isolation is stored as the lite KEY, since
    `JSON.stringify` drops a Lite's constructor-valued `entityType`.
  - `Schema.AttachToUniqueFilter` is NOT ported — its only consumer resolves an entity's id by unique key
    inside a generated migration script, and altea's sync writes no such lookup.
  It needed FOUR core seams, all Signum's own: `ExecutionMode.onSetIsolation` / `withIsolationOf` (whose
  four callers — the process runner, the scheduled-task runner and the two model renderers — now adopt the
  row's scope exactly as Signum's do); `OperationLogic.aroundOperation`, the SCOPING half of Signum's one
  `SurroundOperation` (altea's observing half must not break what it observes, which is the wrong contract
  for a security scope, and its "after" runs at a precise point); `EntityEvents.preUnsafeInsert` now
  taking the CONSTRUCTOR and able to return a replacement, which is Signum's actual signature and was
  documented as unported until this consumer appeared; and `exceptionFilter.applyMixins`.
  Two Signum bugs are fixed rather than mirrored: `IsolationDropdown`'s `data-isolation={name}` is the JS
  global `window.name` (an empty string), so no item could be addressed; and the isolations endpoint's
  error text interpolates an `IsolationMixin` where the isolation is what is worth naming.

- **Signum.Printing → altea-printing: a queue whose last step is an app seam.** A document producer drops a
  LINE instead of printing, a PACKAGE is a batch a process walks, and `PrintingLogic.print` is what actually
  prints — default THROWS, as Signum's does. It found TWO core bugs, both older than the module: an
  `@implementedByAll` reference had **NO sub-tokens on the client** (so `ProcessEntity.data`,
  `OperationLogEntity.target`, `ViewLogEntity.target` and `AlertEntity.target` offered nothing in the column
  chooser), and **`ExceptionLogic.logException` wrote in the AMBIENT transaction** — nearly always one about
  to roll back, so the row went with it while the entity kept the id that insert handed out, which is why
  every process whose per-item action threw died on a foreign-key violation and ended in Error instead of
  Finished. Full ledger: **[altea/docs/port/Printing.md](altea/docs/port/Printing.md)**.

- **Signum.WhatsNew → altea-whats-new: the news are NOT cached, and that is what makes them safe.** Signum
  keeps a `GlobalLazy` of every news item and then re-applies row security to the cached list with
  `Schema.GetInMemoryFilter<T>(userInterface: false)`. altea's `globalLazy` is async and has no in-memory
  twin of a TypeCondition filter (an app registers one explicitly — see eastwind's user-asset scoping), so
  the port QUERIES the table: the row filter is spliced by the LINQ binder exactly as for any other query,
  and the table is one row per release. Same reasoning retires
  `Administrator.QueryDisableAssertAllowed<WhatsNewLogEntity>()` inside `IsRead` — altea's filter cannot be
  suppressed for one subquery, and reading the log directly is equivalent unless an app conditions
  WhatsNewLog, which would mean "you may not see your own read marks". Other divergences: the two `MList`s
  become `@part` rows (`Attachment` → `attachments`, since it is a collection); `[DefaultFileType]` and
  `Schema.ForceCultureInfo` have no counterparts, so the file types are NAMED and the required culture is a
  settable `WhatsNewLogic.defaultCulture` (Signum's own "en" fallback); the static property validation
  becomes a `customValidation` on the route's FieldInfo; `setNewsLog` inserts row by row, because Signum's
  set-based `UnsafeInsert` reads the current user inside a query lambda; and the preview-picture route stays
  AUTHENTICATED where Signum marks it anonymous — the picture is the one part of an unpublished item that
  would otherwise have no gate. **The wire DTOs are declared once in the DATA layer, and their dates are ISO
  STRINGS**, exactly as Signum's generated `string /*DateTime*/`: a DTO is not an entity, so nothing revives
  a Temporal value inside it, and typing one `Temporal.PlainDateTime` compiles and then throws on the first
  `.since(…)`. Three Signum pieces are dead there and not ported (the changelog module registration and its
  two-line `Changelog.ts`, `WhatsNewToast.icons`, and the two placeholder helpers declared inside `start`),
  and one Signum bug is fixed: its optimistic count decrement subtracts ONE even for "Close all". It found a
  CORE bug of altea's own — **`Navigator.raiseEntityChanged(SomeType)` notified nobody**, because a `Type<T>`
  is a constructor here and `.toString()` is its source text, never the clean name `useEntityChanged`
  registered under (Signum's argument is a string, so its `.toString()` is right).

- **Signum.Excel's CLIENT half → altea-office-template (its server half was already there).** The package
  had shipped `PlainExcelLogic` / `ExcelImportLogic` and their three routes since the Word port, with
  nothing calling them: `ExcelClient` / `ExcelMenu` / `ImportExcelProgressModal` /
  `Templates/ImportExcelModel` are that missing caller, so "Export to Excel" and "Import from Excel" are on
  the SearchControl toolbar (and the export on the chart page) as they are in Southwind. Divergences beyond
  the ones `data/Excel.ts` already documents (ExcelReportEntity is not ported, so the menu is two fixed
  items and collapses to a single BUTTON when only export is enabled — Signum's own branch):
  - **there is no QueryDescription**, so the imported type comes off the query's ROOT token
    (`Finder.getQueryRoot(...).type.typeInfos()`) where Signum reads `qd.columns["Entity"].type`, and the
    collection token the validate route answers with is a STRING that `Finder.parseSingleToken` resolves.
  - `token.fullKey` / `queryTokenType == "Element"` are METHODS here (`fullKey()` / `isElement()`), a
    `getTypeInfo(t).operations` read becomes `Operations.operationInfos(ti)`, an enum FIELD holds its
    ORDINAL so `mode` compares through `ImportExcelMode.*` rather than Signum's `"Insert"` literals, and
    the per-row label is built OUTSIDE the JSX attribute (the transformer does not rewrite a lambda there).
  It exposed a CORE gap that had nothing to do with Excel: **`/api/operation/stateCanExecutes` did not
  exist**, so EVERY contextual right-click on a search whose type has a ConstructFromMany — or on a
  multi-row selection — died with "Error in getOperationsContextualItems" and the whole Operations block
  vanished. The route is now `OperationLogic.getContextualCanExecute`: the selection's distinct STATES read
  in ONE `groupBy` over the operation's `getState` `Quoted`, checked against its `fromStates`, with no
  entity retrieved. Divergences: the registry is keyed by symbol alone, so Signum's per-type
  `FindOperation(type, key)` and its group-by-StateType collapse into a lookup; Signum also folds in
  `CanExecuteExpression`, which altea has no counterpart for (`OperationMetadata.hasCanExecuteExpression`
  is never set), so only the state check runs. `AnyReadonly` becomes the `OperationLogic.onAnyReadonly`
  seam that altea-auth fills, set-based exactly as Signum's `CountReadonly` is: the Min/Max bounds first,
  then ONE `SELECT COUNT(*) … WHERE id IN (…) AND NOT(<the role's condition algebra at WRITE level>)` —
  `buildAuthFilter` already compiles that predicate for the row filter, and the count is assembled at
  EXPRESSION level because it only exists at runtime while `Query.count` takes a build-time `Quoted`. A
  role WITH conditions on a type is the normal case, not the exception, so a per-row evaluation there would
  cost one retrieve per selected row on every right-click. The one thing Signum's
  `TypeAuthLogic.DisableQueryFilter()` buys that altea cannot express is suppressing the READ filter for
  that single query; it changes nothing for the caller, whose lites came from an already-read-filtered
  search. Pinned by `altea-auth/test/server/contextualReadonly.test.ts`. The response field is named `isReadOnly`, which is what the CLIENT reads — Signum's
  server writes `AnyReadonly`, so the flag never reached its menu at all. **The route carries the only
  gate**: Signum's whole API is authorized globally by ASP.NET, so its `ParseOperationAssert` is about
  which operation, not about whether one is logged in; here that assert IS what stops an anonymous caller
  from reading any table's state distribution. Fixed alongside: `renderContextualItems` appended a block's
  items only `if (block.header)`, so a header-less block silently contributed nothing.
  And **`getEntityPack` was evaluating EVERY operation in the application against every entity** — ~180
  `canExecute` entries per row for an Order, most of them another type's (`UserOperation.Deactivate`,
  `PrintLineOperation.Print`, …), each one's throw swallowed by a bare `catch`. Its header said altea had no
  server-side per-type registry, which stopped being true when `OperationLogic.operationsForType` landed. It
  is now Signum's `ServiceCanExecute` filter for filter: the operations of the entity's own type (plus every
  one registered on a base it inherits from — the prototype walk is the counterpart of Signum's polymorphic
  (type, symbol) registry), `canBeNew || !isNew`, then the UI authorization. 6 entries for an Order, 2 for a
  Product. A throw from a canExecute body now PROPAGATES, named (Signum rethrows with `e.Data["entity"]`);
  swallowing only made sense while the loop was deliberately running operations that did not apply. Signum's
  `CreateMultiCanExecuteState` scratchpad is not ported — nothing in altea writes to it.

- **Signum.Excel's ExcelReport half → altea-office-template: a stored WORKBOOK, refilled.** The package's
  header used to record this as a deliberate decline ("an .xlsx OfficeTemplate is strictly more capable"),
  which was the wrong conclusion from a true premise. A token template IS more capable at COMPOSING a
  document; an ExcelReport does something else entirely — it takes a workbook an analyst already built in
  Excel (pivot tables, charts, sheets whose formulas read the data), replaces the contents of its one
  "Data" sheet with a query's rows, and repoints every pivot cache at the new range. Nothing in it is
  authored in tokens: a column is matched by its DISPLAY NAME against the query's columns, and each
  column's formatting comes from the sample row under the header. And it is what lets an application READ
  the `excel.excel_report` rows a Signum database already has, which a more capable substitute does not.
  Divergences:
  - **`ExcelReportEntity` lives in its own `data/excel/` directory**, because the schema scope is per
    PACKAGE + DIRECTORY: `data/OfficeTemplate.ts` already claims `data/` for the `word` schema, and a
    second `setDefaultDatabaseSchema` for the same directory REPLACES the first rather than adding to it.
    The longest-prefix rule then puts this one table in Signum's `excel` schema and leaves the rest alone.
  - **the "Data" worksheet is looked up more forgivingly.** Signum reads
    `GetWorksheetPartBySheetName(ExcelMessage.Data.NiceToString())` — the LOCALIZED name — so a template
    authored in one culture cannot be run in another. The port tries the localized name first (a Signum
    template keeps working exactly as it did), then the invariant "Data", and finally accepts a workbook
    that has only ONE worksheet; only a multi-sheet workbook with no recognisable data sheet fails.
  - **the output column ORDER is built explicitly** — template columns in template order, then any query
    column the template does not mention. Signum gets the same order out of a `HashSet<K>` it unions the
    two key sets into, which is true of .NET's HashSet in practice but is not a documented guarantee, and
    a file's column order is not something to leave to one.
  - **the calculation chain is DROPPED, not just flagged.** Signum sets `ForceFullCalculation` /
    `FullCalculationOnLoad` and leaves the chain, which names cells that no longer exist — the thing that
    makes Excel offer to "repair" the file. `SpreadsheetUtils.removeCalcChain` / `forceFullCalcOnLoad`
    (already written for the template renderer) do both.
  - **the `.xlsx` extension is a field VALIDATION as well as Signum's run-time assert**, so a template
    saved with the wrong extension is refused when it is saved rather than the first time someone runs
    the report. Both call one shared rule.
  - `GetColumnWidth` is not ported: it is dead code in Signum (nothing calls it), and an ExcelReport takes
    its widths from the template, which is the point of having one.
  - still NOT ported: `ExcelAttachmentEntity` (a UserQuery exported to .xlsx as an email attachment) —
    that one really is what altea-office-template's own attachment already does.
  It needed one CORE addition, which is Signum's own placement: **`GET /api/query/queryEntity/:queryKey`**
  plus `Finder.API.fetchQueryEntity`, whose client stub had been sitting commented out with that exact
  url. A client needs the QueryEntity ROW whenever it builds an entity that references a query (a new
  UserQuery, a new ExcelReport), because the FK is the row and not the key; altea-user-queries had been
  carrying a private copy of the route gated on its own permission. The core one is gated on the QUERY's
  authorization, which is the right question.

- **Signum.MachineLearning → altea-machine-learning: a CODIFICATION is the unit, and CNTK becomes
  TensorFlow.js.** A predictor names a registered QUERY, marks each column Input or Output, and trains a
  model over the rows; a *codification* is ONE number in the model's input or output vector, which is why
  the codifications are persisted rather than recomputed — a prediction made months later must land in the
  same slots, with the same normalization statistics, as the training. `@tensorflow/tfjs-core` +
  `-layers` + `-backend-cpu` are the substrate (`tfjs-node` is an OPTIONAL backend registration for the
  same API — `useBackend("tensorflow")`, and `/api/predictor/backend` says which one is live, because a
  pure-JS backend trains the same model far slower and that is worth knowing rather than guessing).
  Divergences:
  - **`MList` → `@part` rows, and the main query's filters/columns hang off the PREDICTOR.** Signum keeps
    them inside `PredictorMainQueryEmbedded`; a `@part` collection needs a real owner TABLE, so
    `PredictorEntity.filters` / `.columns` are the predictor's own and the embedded keeps only
    `query` + `groupResults`. The designer still presents them as one "main query" block.
  - **the ROOT entity token is `""`**, where Signum spells it `"Entity"` — altea has no storable root
    token. It bit both tiers (the predict path's filter and the sub-query creator's ParentKey seed).
  - **`isValue` and the split keys round-trip through the filter-value converter**
    (`stringifyFilterValue` / `parseFilterValue`, altea's counterpart of Signum's
    `FilterValueConverter`), and `objectArrayKey` keys a Lite by its KEY. Getting this wrong is silent:
    a Lite's `toString()` is its DISPLAY text while the one-hot dictionary looks a value up by
    `lite.key()`, so a stored "Margaret Peacock" never matched the incoming "Employee;4" — every one-hot
    column over a reference matched nothing at PREDICT time and answered as if the value were unknown.
    Training is unaffected (the values are still live objects there), which is exactly why it hides.
  - **`inputsFromEntity` fills EVERY column, outputs included** (Signum's `FromFilters` does the same):
    one dictionary is both the prediction's inputs and the record of what actually happened, which is what
    lets the predict page show "the model says 98.53, the truth was 38.28". The outputs are ignored when
    the vector is encoded, so carrying them cannot influence the answer.
  - **the interactive prediction is a PAGE, not Signum's modal** —
    `/machineLearning/predict/:predictorId?entity=<liteKey>` — so a prediction has a shareable URL; the
    content is Signum's `PredictModal` (editable inputs, a re-prediction per edit through an
    `AbortableRequest`, the original dimmed while one is in flight, the alternatives checkbox for a
    classification). Its wire DTOs live in the DATA layer and carry a token as a STRING, which the page
    resolves through `Finder.TokenCompleter` — altea has no QueryDescription, so a serialized token DTO
    would be a second, weaker copy of a model the client already builds.
  - **`PredictDictionary.options`** carries the decode options (Signum's same field), so a batch may mix
    rows asking for alternatives with rows asking for the winner.
  - **the loss chart is inline SVG**, not Signum's d3 `LineChart`: a fixed two-series line chart over a
    few hundred points needs no scale abstraction, and it keeps the module off a charting dependency for
    one view. The validation series is drawn with GAPS, because it is only recorded every
    `saveValidationProgressEvery` epochs and joining across them would draw through points nobody
    measured. The four grid formatters keep Signum's light/dark colour pairs for the same reason — the
    two curves DIVERGING is what overfitting looks like.
  - **`ProgressBar` is local** (altea's framework has none) and **`initializeColumn` is its own module**
    (Signum imports it back out of `Templates/Predictor.tsx`, a cycle that survives only because a
    function declaration is hoisted).
  - **the four symbol tables need `SymbolLogic.start`**, whose `withQuery()` the designer's algorithm /
    encoding / result-saver combos need: they load their options by RUNNING the type's query. They come
    LAST in `start`, because the default
    `getSymbols` is "every DECLARED symbol of this type" and a declaration happens when its container is
    first touched — `registerAlgorithm` / `registerResultSaver` above are what touch them.
  - **`IgnorePinned` is called by the MODULE**, not left to the app as in Southwind: altea's filter rows
    share `QueryFilterBaseEntity`, so those seven pinned columns exist unless the module says otherwise,
    and an app that forgot the call would silently get a schema Signum does not have.
  - NOT ported: the CSV / TSV / TensorFlow-projector export links (a matrix serializer plus three
    routes, and the projector link is a `window.open` of a public site — `PredictorMessage` keeps their
    labels), `PredictorEntity.MainQuery.ParseData` (gone with QueryDescription — a stale token fails at
    TRAIN time with the predictor named), and Signum's `getHelpBlock` (a switch that can only produce an
    empty string or an exception) with its unused `LabelWithHelp`.
  It found TWO core bugs, both older than this module and both app-wide:
  - **`Navigator.hasAllowedConstructor` denied construction for every type with no plain Constructor
    operation.** Signum's rule is "if a CONSTRUCTOR operation exists for the type but the role may not run
    it, refuse" and it reads a server-computed `TypeInfo.hasConstructorOperation`; altea approximated that
    as "does any operation exist that is neither Execute nor Delete", which a **ConstructFrom** satisfies
    — so the moment altea-alert / altea-notes registered `CreateAlertFromEntity` /
    `CreateNoteFromEntity` on `Entity` (inherited by every type), every `@part` row type answered false.
    Visible symptom: no "Create" row on any EntityTable / EntityRepeater over a `@part` collection —
    a UserQuery's columns and orders could not be added to — and no "Create new X" button on such a
    type's search page. `TypeMetadata.hasConstructorOperation` now carries the flag, computed in
    `ReflectionServer.buildMetadata` BEFORE the per-role filter (it is the one field there that is
    deliberately role-independent).
  - **`QueryTokenEmbeddedBuilder` never resolved a STORED token.** `QueryTokenEmbedded.token` is
    `@serialize(false)` — the server only ever sees `tokenString` — and nothing revived it on load, so
    every stored column / order / filter of every UserQuery, UserChart and template rendered the token
    builder's "…" placeholder forever and could not be edited without re-picking. It resolves there now
    (in local state, so an untouched form does not look modified), and a token that no longer resolves
    shows its message instead of hanging.
  Plus one smaller pair in the Lines, in the path of a JSX `label`: `isLabelVisible` was
  `!(style === "SrOnly" || "visually-hidden")` — a precedence mistake whose bare string literal made it
  ALWAYS false — and the accessible name was `String(p.label)`, which for a React element is the literal
  text "[object Object]". Both now go through `client/Lines/ariaLabel.ts`.

- **A download's file name is written in BOTH `Content-Disposition` forms, from one helper.** ASP.NET's
  `File(bytes, contentType, fileName)` emits `filename="…"; filename*=UTF-8''…` and Signum's
  `Services.getFileName` reads the `filename*=` one first, so its ASCII branch — `.replace("\"", "")`,
  which drops only the FIRST quote because a string pattern is not global — is dead code there. altea's
  routes wrote only the quoted form, so that branch ran and left a trailing `"` on every download name;
  a browser sanitises one to `_`, which is why an Excel export saved as `Product….xlsx_` with a
  "XLSX_ File (*.xlsx_)" type. The fix is on the WRITING side, so the reader stays Signum's verbatim:
  `attachmentDisposition(fileName)` (`altea/server/webApi`) writes the ASP.NET pair — the legacy quoted
  form with `"` / `\` replaced, plus the RFC 5987 `filename*=UTF-8''` one — and every route that serves a
  file goes through it, so the `filename*=` branch always wins and the buggy ASCII one is unreachable here
  too. It also fixes a second latent bug at the four call sites that were
  percent-encoding INTO the plain `filename=`: a non-ASCII name arrived as literal escapes
  (`Pedido%20a%C3%B1o.xlsx`). @altea/altea-mailing-microsoft-graph's attachment route was the only one
  already writing the pair by hand — it is now the helper's caller like the rest.

- **The MULTI-SETTER ("bulk modifications") is ported on both sides, and its property paths never cross an
  entity reference.** Signum's 561-line `MultiPropertySetter.tsx` had been left a STUB whose `show()`
  resolved to no setters — so a contextual operation labelled "(Multi setter)" ran with no dialog — and its
  server counterpart (`OperationController`'s `MultiSetter.SetSetters`) was not ported at all. Both exist
  now: `altea/client/Operations/MultiPropertySetter.tsx` (the dialog) and `altea/server/multiSetter.ts`
  (which the three `*Multiple` routes call on each freshly retrieved entity, in that lite's own
  transaction, before the operation runs). Divergences:
  - **a setter's `property` is an EMBEDDED-only path.** altea's `PropertyRoute.add` RE-ROOTS at a
    referenced concrete type (Signum's AddImp), so `"supplier.companyName"` is not a representable route
    string — the prefix is lost. The selector therefore stops at every entity reference and the server
    REFUSES such a path rather than guessing. Nothing is given up: a reference is edited through
    `ModifyEntity` / `CreateNewEntity`, whose nested setters are rooted at the referenced type — the same
    mechanism a collection already uses. Signum's own `PropertyPart` meant to allow the in-path form for a
    Part and got the condition wrong (`ti.entityKind == "Part" || ti?.entityKind != "SharedPart"`, true for
    both branches it meant to admit), so a Part could not be drilled into there either.
  - **MList is gone**, so a collection's element is a `@part` row ENTITY: Signum's
    `isCollection && (isEmbedded || isPart(name))` collapses to "the element is a part entity", and the
    nested block is rooted with `PropertyRoute.root(elementCtor)`. `RemoveElementsWhere` / `RemoveElement`
    splice IN PLACE, so the saver's snapshot diff sees the removal exactly as for a UI edit.
  - **the predicate is EVALUATED, not compiled.** Signum reuses
    `QueryUtils.GetCompareExpression(..., inMemory: true)`; altea's filters only ever lower to SQL, so
    `compareInMemory` implements the operations `FindOptions.filterOperations` offers per FilterType and
    REFUSES the full-text / Complex / Smart ones rather than approximating them.
  - **a value is coerced against the target route**, the way `queryServer`'s `deserializeFilterValue`
    coerces a filter value: the setter list is not an entity graph, so the request deserializer revives only
    what carries a discriminator (a Lite / entity / embedded) and a date, a decimal and an enum arrive as
    their wire scalar. (An enum value posted by the dialog is the ORDINAL, because the line binds a plain
    object property rather than a reflected field; a member NAME is accepted too.)
  - **`AssertCanWrite` becomes `propertyWriteAccess`** (`data/serializer`, new beside
    `serializationAuthMetadata`): the same gate the codec applies, asked directly because these writes
    bypass the codec, and it THROWS where the codec silently keeps the original — "changed 500 rows" must
    not be a lie.
  - **a missing embedded along a path is CREATED.** Signum initializes a non-nullable embedded in the field
    declaration so its walk never meets a null; altea deliberately declares no such initializers, so
    "set `shipAddress.city`" would otherwise fail for exactly the rows whose address is unset.
  - **`id` / `ticks` are not offered.** Signum lists them (its `TypeInfo.members` carries both and its
    selector filters nothing), but setting either in bulk is never meaningful — `id` would repoint the row
    and `ticks` is the concurrency stamp, the same two the serializer excludes. `@backReference` /
    `@rowOrder` / `@serialize(false)` members are dropped for the same reason.
  It also filled a route GAP: **`/api/operation/constructFromMultiple` did not exist.**
  `Operations.API.constructFromMultiple` is what a contextual ConstructFrom over a MULTI-row selection
  posts to (as opposed to `constructFromMany`, one entity out of the whole selection), and it had always
  been called — so every such menu entry 404'd. And `PropertyOperationEnum` is now `registerEnum`'d, so
  `Enum.niceName` finds the translated member names the shipped XMLs already carried.

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
| isolation (tenancy domain) | `ALTEA_ISOLATION_TEST_DB` | `pnpm --filter @altea/altea-isolation test:postgres` |

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
