# altea — Roadmap

TypeScript LINQ provider / ORM inspired by Signum Framework.
Reference implementation: `old/` submodule (Signum Southwind — do not modify).

> This is a living roadmap, not a spec. For parts marked ✅, **the code is the source of truth** — design detail has been removed once implemented. Open design questions live under "Next steps".

---

## Layout

Multi-package monorepo under `altea/` (git submodule):

```
altea/
  altea/                     @altea/altea — core (project-referenced sub-builds)
    entities/                entity model, decorators, validators, reflection, mixins
                             (replaces the old all/ + client-shared layer)
    logic/                   schema, table, query, expressions, context.node, visitors/
                             (replaces the old back/ layer; server-side)
    react/                   context.browser (replaces the old client/ layer)
  altea-auth/                @altea/altea-auth — UserEntity + AuthLogic (stub)
  altea-test/                @altea/altea-test — Music domain (port of Signum.Test),
                             MusicLogic/MusicStarter/MusicLoader (schema gen + live exec)
  quote-transformer/         compile-time @field injection + @quoted lambda capture
  quote-transformer-test/    transformer test suite
```

Per-module `all`/`back`/`client` split from the original design became the
`entities`/`logic`/`react` package boundaries.

---

## Status

| Area | Milestone | Status | Notes |
|---|---|---|---|
| **A** Entity model | `BaseEntity`(`.init`/`.mixin`) + `@reflect`, `Entity`, `Embedded/ModelEntity`, `Lite`/`LiteImp`, `PrimaryKey` | ✅ | `isDirty()`/`isModifiedSelf()` now real (snapshot-based, on `BaseEntity`); `toLite()` works |
| **A** Transformer v2 | auto-`@field`, two-arg generics (`Lite<T>`/`Array<T>`), `@quoted` capture | ✅ | well tested |
| **A** Decorators/validators | `@field`, string/url/tel/email/noRepeat validators, `@ignore`, `@fkProperty`, `@implementedBy(All)`, `@entity`, `EntityKind`, `EntityData` | ✅ | `@uniqueIndexValidator` **missing** |
| **A** FK dual props | `@fkProperty` override + `FieldInfo.fkPropertyName` | 🟡 | `xId` naming-convention auto-pairing **not** done |
| **A** Mixins | `@mixin`, `MixinDeclarations.register`, `.mixin<M>()` cast | ✅ | no usage example yet |
| **B** Schema/Table | `Table`, `Column`, `ObjectName`, `@column` | 🟡 | data structures only |
| **B** Field hierarchy | `FieldValue/Reference/ImplementedBy/Embedded/MList…` | ❌ | |
| **B** `SchemaBuilder`/`EntityBuilder` | fluent `include()`/`withQuery()`/… | ❌ | |
| **B** Schema generator (DDL) | `Schema` → CREATE SCHEMA/TABLE/FK | ✅ | `SqlPreCommand`, `SqlBuilder` (both dialects), `Schema.generating` event chain + `generationScript()`. Unsized string columns now render unbounded (`nvarchar(MAX)` / bare `varchar`) instead of SQL Server's silent `nvarchar(1)`. Indexes pending (no index model yet) |
| **B** Connectors | `Connector.current`/`default`, `SqlServerConnector` (mssql), `PostgresConnector` (pg) | ✅ | ambient via `context.node`; live execution (`executeScript`/`executeNonQuery`/`executeQuery`) |
| **B** Schema synchronizer | introspect → diff → `SyncScript` | ❌ | next: introspection + diff |
| **C** Snapshot/change detection | reflection-based snapshot, real `isDirty`/`isModifiedSelf` | ✅ | `entities/changes.ts`: normalized projection off `FieldInfo` (own + mixin fields), embeddeds inlined, references→id (fat-lite live id via `referenceKey`), collections→ordered id-list (so owner is self-modified on add/remove/reorder → `ticks`/concurrency). `cleanModified` re-baselines. Lives in entities/ so it runs client-side too |
| **C** Save/ORM | `save` (graph), `GraphExplorer`, `Saver`, optimistic concurrency | 🟡 | `logic/saver.ts` saves the whole reachable graph in one transaction: integrity → save-set (graph-modified via `propagateModifications`) → cascade-wire owned child rows (back-ref FK + `@rowOrder`) → topological INSERT/UPDATE → commit-time re-baseline. `logic/graphExplorer.ts`: `exploreModifiables`, `propagateModifications`, `forwardReferences`/`collectionChildren`, `fullIntegrityCheck`. **`ticks` optimistic concurrency live**: UPDATE writes `ticks = old + 1 WHERE id AND ticks = old`, 0 rows → `ConcurrencyException`. **Verified end-to-end**: the full `MusicLoader.load()` persists to Postgres (counts + folder ticks + IBA discriminators checked). **Snapshot-on-retrieve now landed** via the LINQ `Retriever` (D step 4) — materialised entities are `cleanModified` on load (`isDirty()=false`). Pending: deferred-FK reference cycles (throws for now), batch `InsertMany`/`UpdateMany`, `load`/`tryLoad`/`deleteEntity` + orphan removal |
| **D** Query | `Query<T>` AST, `IQuery`, `flatMap`, `Connector`, `withQuoted` | 🟡 | translator stubbed; `withExpressionFrom` missing. `Connector` now real (see **B** Connectors). `groupBy` typing fixed (used `keySelector` for elements; now returns `Array<{key,elements[]}>`). **Terminals going async** (`toArray(): Promise<T[]>` …) — Node drivers are async-only |
| **D** Bulk ops | `executeDelete/Update/Insert` | ❌ | DELAYED (after collections) |
| **D** SQL translator | Expression AST + `ExpressionSimplifier` ✅; `DbExpression`, QueryBinder, QueryFormatter, ProjectionReader ❌ | 🟡 | **Active work — see "LINQ provider build plan" below.** AST + one optimiser visitor exist |
| **E** JSON serializer | `EntitySerializer` | ❌ | |
| **E** `QueryTokenString.nav()` | typed token strings | ❌ | |
| **Aux** Context | `context.node` (AsyncLocalStorage) + `context.browser` | ✅ | not in original plan |
| **Aux** Test env | `@altea/altea-test`: Music entities + MusicLogic/Starter/Loader | 🟡 | schema generation works both dialects; **`MusicStarter.start()` now generates AND loads the full sample graph live — verified on BOTH Postgres and SQL Server** (row counts, folder ticks, durations, IBA discriminators checked). Loader sets `state`/`index`/`year`/`order` that Signum value-type defaults or the Save operation supplied. MList/hierarchy/vector features commented out |
| **Aux** Auth | `@altea/altea-auth`: `UserEntity` ✅, `AuthLogic` empty | 🟡 | low priority |

Legend: ✅ done · 🟡 partial · ❌ not started

---

## Next steps

**Now — close Phase A loose ends** (small, unblock everything downstream):

1. **`@uniqueIndexValidator`** — add to `entities/validators.ts` + `decorators.ts` alongside the existing validators.
2. **FK `xId` convention auto-pairing** — when a field `employee: Lite<T>` has a sibling `employeeId`, link them in `FieldInfo` automatically (today only the explicit `@fkProperty('…')` override works).
3. **A mixin usage example/test** — exercise `@mixin` + `.mixin<M>()` end to end so the pattern is proven before schema depends on it.
4. ~~`toLite()` / `isDirty()` stay stubs~~ — **done**: both are real now (snapshot change tracking landed in **C**).

**Then — finish the entity round-trip (C) or push the LINQ translator (D).** The save side is in place (`Saver`); the missing half is **retrieve** (materialise rows → entities, take the clean snapshot on load) so a full save→load→re-save cycle works against a live DB. Remaining Saver hardening: deferred-FK reference cycles (currently throws), batch `InsertMany`/`UpdateMany`, and `deleteEntity` + orphan removal. **The retrieve half is built *by* the LINQ provider's entity materialisation (D §ProjectionReader/Retriever) — the two close together.**

---

## LINQ provider build plan (D — active)

**Strategy: port Signum `Engine/Linq/` pass-for-pass.** Everything downstream of binding (DbExpression tree, visitor base, optimisers, QueryFormatter, TranslatorBuilder, ProjectionReader) ports faithfully. Only **QueryBinder** is adapted, because the input is altea's JS-operator AST (`expressions.ts`: `CallExpression` on a named `PropertyExpression`, `BinaryExpression "=="`) not C# `MethodCallExpression`. The pipeline replaces the `throw` in `MyQueryTranslator.translate()` (`table.ts`):

`simplify (have it) → QueryBinder → optimiser passes → ChildProjectionFlattener (DELAYED) → TranslatorBuilder{ProjectionBuilder(eval-codegen) + QueryFormatter} → TranslateResult.execute() [async]`

Decisions taken (Olmo):
- **Async terminals**: `toArray`/`first`/`count`/… return Promises (connector is async-only).
- **TDD-first**: translate *all* Signum `LinqProvider/*.cs` tests into `altea-test` to lock a stable `Query<T>` API **before** implementing the translator.
- **`TranslatorBuilder` compiles the projector via eval/codegen** (`new Function`), mirroring C#'s `Expression.Compile()` — not a tree interpreter.
- **Collections ≈ MList**: altea has no MList tables, but `FieldEntityArray`/`@backReference` part-entities (already modelled in `music.ts`) play the same role; the collection projection machinery is a near-port of Signum's MList* nodes, not a fundamental divergence. Entity collections inside quoted lambdas borrow `@lambdaTypeForParam`/`@resultType` from `Query<T>` (already routed via `OrderedQuery.prototype` in `expressions.ts`).
- **Ask before any divergence** beyond the agreed delays.

New module layout (mirrors `old/Framework/Signum/Engine/Linq/`): expand `expressions.sql.ts` (full DbExpression hierarchy) + `logic/linq/` { `aliasGenerator`, `dbExpressionVisitor`, `queryBinder`, `columnProjector`, `dbExpressionNominator` (minimal first), `smartEqualizer`, `visitors/*`, `queryFormatter`, `translatorBuilder`, `projectionReader` }.

Pass order — **build now**: EntityCompleter(+QueryJoinExpander) → AliasProjectionReplacer → OrderByRewriter → QueryRebinder → ConditionsRewriter(+Postgres) → UnusedColumnRemover + RedundantSubqueryRemover.
**Delayed (Olmo's order)**: (1) ChildProjectionFlattener/collections → (2) Unsafe DML → (3) AggregateRewriter + DuplicateHistory (so `groupBy` + temporal `AsOf` come last). ScalarSubqueryRewriter skipped (both dialects support scalar subqueries).

Implementation order (each ends green): 0. ✅ **port all LinqProvider tests** (TDD) → 1. ✅ DbExpression scaffolding + visitor + AliasGenerator → 2. ✅ binder skeleton (`filter`+`map`) + minimal Nominator/ColumnProjector → 3. ✅ formatter+reader for **scalars/tuples** end-to-end (first proof) → 4. ✅ full-entity materialisation via `Retriever` (closes C retrieve) → 5. navigations + JOINs → 6. order/page/distinct/unique/scalar-aggregates → 7. polymorphism + Lite + SQL functions → 8. delayed tiers.

**Step 4 done** — entity materialisation via a `Retriever` in `logic/linq/translatorBuilder.ts`. The projector codegen now emits, for an `EntityExpression`, `retriever.entity(ctor, idCol, e => { e.field = …; })` (mixin fields assigned onto the same instance), for a lazy reference `retriever.stub(ctor, fkCol)`, and for an `EmbeddedEntityExpression` `(hasValue ? retriever.embedded(ctor, …) : null)`. `Retriever` caches by `type:id` (identity within a result), and **takes the clean change-tracking snapshot on load** (`cleanModified`) — so a freshly-retrieved entity has `isNew=false`/`isDirty()=false`. **This closes the Phase-C "retrieve"/snapshot-on-load gap.** Binder now resolves the embedded ctor from the field's `typeName` (so embeddeds construct). Nominator fix: `PrimaryKeyExpression` is no longer collapsed into a column — the wrapper is kept so the reader treats the id specially. Verified by `binder.test.ts` (10 passing, no DB): whole-entity → `AlbumEntity` with clean snapshot; FK column → `LabelEntity` stub; nullable embedded honours `hasValue` → `SongEmbedded`. **Pending:** deferred batch-completion of reference stubs (their non-id fields aren't loaded yet), Lite materialisation/model, collections.

**Step 3 done** — `logic/linq/queryFormatter.ts` (DbExpression tree → SQL text + positional params; dialect-aware: pg `$n`/`"id"` vs SQL Server `@pN`/`[id]`; SELECT/FROM/WHERE/ORDER BY/TOP-LIMIT/JOIN keywords, scalar ops incl. null-aware `= NULL`→`IS NULL`), `logic/linq/translatorBuilder.ts` (`TranslateResult` + eval-codegen projector: `compileProjector` emits a `(row,consts)=>value` body via `new Function`, reading `row["<colAlias>"]`; `async execute()` runs the query and maps rows; `applyUnique` for First/Single). `MyQueryTranslator.execute` now binds→formats→executes (returns a Promise); `getQueryTextForDebug` returns real SQL. **Query terminals are now async** (`toArray`/`count`/`first`/… → `Promise<…>`; `IQuery`+`Query` updated together). Verified by `binder.test.ts` (8 passing, no DB): bound-tree shape, SQL text + params both dialects, and full format→execute→project via a `FakeConnector` (scalar → values, object literal → objects). Entity/embedded projector nodes throw "step 4" pending the Retriever.

**Step 2 done** — `logic/linq/queryBinder.ts` (adapted port: recognises the marked `table(T)` source → `getTableProjection` building an `EntityExpression`+`SelectExpression`; binds `filter`→Where, `map`→Select; `mapVisitExpand` binds lambda bodies; `bindMemberAccess` resolves `.id`→externalId and value/embedded fields → columns; value/enum/embedded/single-reference fields mapped — IB*/collections deferred), `logic/linq/dbExpressionNominator.ts` (minimal: collects server-evaluable candidates bottom-up), `logic/linq/columnProjector.ts` (`ColumnProjector`+`ColumnGenerator`, splits projector into SELECT columns + rebuilt projector). `table.ts` marks `table` as a query source and `MyQueryTranslator.bind()` runs simplify→bind (execution still throws — step 3). Verified by `altea-test/test/binder.test.ts` (4 passing, no DB): bare table, filter→WHERE, map-scalar→1 column, map-object→2 columns.

**Step 1 done** — `logic/linq/aliasGenerator.ts` (`Alias` + `AliasGenerator`, port of AliasGenerator.cs), `logic/expressions.sql.ts` expanded to the core `DbExpression` hierarchy (sources: Table/Select/Join + Column/ColumnDeclaration/OrderExpression; scalars: Aggregate/SqlFunction/SqlConstant/Case+When/Like/Scalar/Exists/In/IsNull/IsNotNull; Projection/ChildProjection+LookupToken; entity-semantic: Entity/Embedded/Mixin/FieldBinding/PrimaryKey), and `logic/linq/dbExpressionVisitor.ts` (identity-preserving `DbExpressionVisitor`, double-dispatch via `accept`, generic fallback to source-level `visitChildren` for Binary/Constant/… inside WHERE/projector). Builds clean (`tspc -b --force`). Deferred to their tiers: command nodes (Update/Delete/Insert), MList*, ImplementedBy*, Lite*, Type*, Interval/temporal, TVF, RowNumber, SqlCast, hierarchy.

**Step 0 done** — `altea-test/test/` has 26 ported LinqProvider suites (~600 test methods) that compile under `tspc` (the quote-transformer captures them) and run via `node --test` (the [loader.mjs](altea/altea-test/loader.mjs) resolver hook); they SKIP without `ALTEA_TEST_DB`, so compile-clean is the API-stability gate. The C#→altea idiom is [PORTING.md](altea/altea-test/test/PORTING.md); the surfaced API/feature backlog (the translator's red→green targets) is [API-GAPS.md](altea/altea-test/test/API-GAPS.md). Enabling API added this phase: `Entity`/`Lite.is()`, `Array<T>` query operators (in globals.ts), quote-transformer **cast** (`x as T`) + `x!` support (+ `CastExpression`). Deferred (not ported): FullTextSearch×2, VectorSearch×2, SystemTime — they need pgvector/hierarchyid/temporal features altea doesn't model yet.

---

## Architecture decisions (kept for rationale)

| Decision | Choice |
|---|---|
| `Lite<T>` | `abstract class Lite<out T>`; concrete `LiteImp<T>` with `toStr`; no separate model class |
| Entity init | static factory `Entity.create(values)` (explicit `this: new()=>T` binds the subclass; `InitValues` drops method props) |
| Base class | `BaseEntity` (the original "ModifiableEntity"); `Entity`/`EmbeddedEntity`/`ModelEntity` extend it |
| `@field` on entity fields | transformer auto-injects for classes marked `@reflect` (`@entity` implies it); single options arg `@field({ typeName, name?, nullable?, lite?, array?, enum? })`. The type is a **name string** (never `() => Type`), so no imported type is referenced at runtime → never elided. Entity/embedded names resolve to constructors via a name→ctor registry (`registerType`/`resolveType`, populated by `@reflect`/`@entity`); value types resolve by name in `defaultDbType`; enums are flagged `enum: true` |
| Entity reference resolution | two paths: (1) `@include(() => OtherEntity)` — user-written thunk stored in `FieldInfo.include`; the arrow keeps the import alive (no elision, no `verbatimModuleSyntax`) and hands the builder the ctor **by reference** (rename-proof, no registry, no load-order). Preferred when present. (2) registry `resolveType(typeName)` fallback — used for dynamic/LowCode entities with no static import. `@implementedBy(() => [...])` already supplies ctors via its own lambda, so a bare `@include` there reuses them (no repetition). Chosen over `verbatimModuleSyntax`/resolver-patching for tsc≡tsgo portability |
| FK dual properties | `employee: Lite<T>` ⇒ implicit `employeeId` column; explicit `employeeId` property linked by convention or `@fkProperty` |
| Arrays in entities | only `Entity[]` back-FK (virtual MList); single embedded allowed, arrays of embedded not |
| Many-to-many | explicit junction entity |
| Mixins | `@mixin(Target)` / `MixinDeclarations.register`; `.mixin<M>()` is a cast |
| `@implementedBy` / `@implementedByAll` | same semantics as Signum C# |
| Cross-module expressions | `withQuoted` + `declare module` augmentation in the entity's `entities/` file |
| Change detection | reflection-driven snapshot, not setter/Proxy flags. `isModifiedSelf` (own columns): normalized primitives + FK ids; single embeddeds **inlined** into the owner's image; collections stored as their **ordered element-id list**, so add/remove/reorder makes the *owner* self-modified. Lives in `entities/changes.ts` so `isDirty` works on the client. (Detection only; the columns written come from `collectAssignments`, so collection ids in the snapshot don't affect SQL.) Orphan-delete on removal still TODO — the stored id-list will drive it |
| Modification propagation | the **save set is the graph-modified set**, not just self-modified: `graphExplorer.propagateModifications` rolls a child's change up to its owners/referrers (Signum's `PropagateModifications`), so a parent's row re-saves and its `ticks` bumps when an owned child's *content* is edited — the aggregate concurrency boundary. Edges = what `exploreModifiables` follows (full refs + fat lites in, thin lites out), so a thin-`Lite` reference to another aggregate is a natural boundary. The column-image snapshot only lets us drop Signum's mutable `SelfModified`/`Modified` enum (propagation is a one-shot reachability pass), not the propagation itself |
| Bulk ops | `executeDelete/Update/Insert` on `Query<T>`; `deleteEntity` delegates to `executeDelete` |
| Optimistic concurrency | every non-enum table has a non-null `ticks` (bigint); INSERT writes `ticks = 0`, UPDATE writes `ticks = old + 1` guarded by `WHERE id = ? AND ticks = ?(old)` — 0 rows affected ⇒ `ConcurrencyException`. The save set already includes any entity whose owned child changed (propagation), so an aggregate's `ticks` advances on child edits too. `ticks` is in the snapshot's RESERVED set, so bumping it never itself marks an entity dirty |
| `@implementedByAll` discriminator | interim: the type column is a `varchar(100)` holding the **clean type name** (e.g. `"Band"`) that `save.ts` writes, since there is no `TypeEntity` table yet to map types to int ids. Becomes an int FK once that table lands |
| Nullable embedded columns | a nullable embedded (`X | null`) forces **all** its flattened sub-columns nullable regardless of the sub-field's own nullability — presence is tracked by the `hasValue` column, and an absent embedded leaves every sub-column NULL |
| Temporal value formatting | save normalizes Temporal types to dialect-portable strings: datetime/time capped at millisecond precision (native nanoseconds overflow SQL Server `datetime2(7)`), `Duration` rendered as clock `HH:MM:SS` (both SQL Server `time` and Postgres `interval` accept it; `"PT4M54S"` does not). Unsized string columns render unbounded so SQL Server doesn't silently truncate at `nvarchar(1)` |
| Value-type defaults | the loader (a port of C# that relied on value-type zero defaults) leans on entity-field initializers for non-null `int` fields it leaves unset (`index`, `AwardNomination.year`/`order`); `state` is set explicitly since Signum's Save *operation* set it |
| Save ordering | `Saver` walks the graph from the root(s), saves the reachable **self-modified** entities only, ordered by FK dependency (`forwardReferences`): an entity is written once everything it points at has an id. Owned collection rows are cascade-wired first (back-ref FK set to the owner *entity* so its live id is read at INSERT, `@rowOrder` set from array index) and so depend on the owner. Existing/clean references need no ordering (their id predates the save). Reference cycles throw for now (no deferred-FK pass yet) |
| SQL translator pipeline | mirror Signum `Engine/Linq/`: QueryBinder → optimisers → QueryFormatter → TranslatorBuilder → ProjectionReader |

---

## Open questions

- **Next big slice:** Schema+Save (B→C) or LINQ translator (D)? Translator can't materialise results without the schema layer, which argues B→C first.
- **DB dialects:** still targeting both SqlServer and Postgres for the generator/formatter, or pick one first?
- **`altea-auth`:** when does auth logic become real work vs. staying a placeholder?
