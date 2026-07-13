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
| **A** Decorators/validators | `@field`, string/url/tel/email/noRepeat validators, `@ignore`, `@fkProperty`, `@implementedBy(All)`, `@entity`, `EntityKind`, `EntityData` | ✅ | uniqueness is a schema `@uniqueIndex` (done — see B), not a validator |
| **A** FK dual props | `@fkProperty` override + `FieldInfo.fkPropertyName` | 🟡 | `xId` naming-convention auto-pairing **not** done |
| **A** Mixins | `@mixin`, `MixinDeclarations.register`, `.mixin<M>()` cast | ✅ | no usage example yet |
| **B** Schema/Table | `Table`, `Column`, `ObjectName`, `@column` | 🟡 | data structures only |
| **B** Field hierarchy | `FieldValue/Reference/ImplementedBy/Embedded/MList…` | ❌ | |
| **B** `SchemaBuilder`/`EntityBuilder` | fluent `include()`/`withQuery()`/… | ❌ | |
| **B** Schema generator (DDL) | `Schema` → CREATE SCHEMA/TABLE/FK | ✅ | `SqlPreCommand`, `SqlBuilder` (both dialects), `Schema.generating` event chain + `generationScript()`. Unsized string columns render unbounded (`nvarchar(MAX)` / bare `varchar`). **Indexes done**: `TableIndex` model + automatic FK indexes, field `@index`/`@uniqueIndex`, class-level composite `@index`/`@uniqueIndex(e => …)` with INCLUDE columns and filtered `where` predicates (rendered per dialect) |
| **B** Connectors | `Connector.current`/`default`, `SqlServerConnector` (mssql), `PostgresConnector` (pg) | ✅ | ambient via `context.node`; live execution (`executeScript`/`executeNonQuery`/`executeQuery`) |
| **B** Schema synchronizer | introspect → diff → `SyncScript` | ✅ | comprehensive: `Schema.synchronizationScript()` diffs schemas, tables (+ column/FK/index/default/identity changes), enum rows, views, functions/procedures — via IView catalog readers. Round-trips to empty on a fresh schema; drift-tested (tables/columns/indexes/enum-rows/functions). Interactive renames via `Replacements`. Views inherit Signum's SS-matches / pg-regenerates asymmetry |
| **C** Snapshot/change detection | reflection-based snapshot, real `isDirty`/`isModifiedSelf` | ✅ | `entities/changes.ts`: normalized projection off `FieldInfo` (own + mixin fields), embeddeds inlined, references→id (fat-lite live id via `referenceKey`), collections→ordered id-list (so owner is self-modified on add/remove/reorder → `ticks`/concurrency). `cleanModified` re-baselines. Lives in entities/ so it runs client-side too |
| **C** Save/ORM | `save` (graph), `GraphExplorer`, `Saver`, optimistic concurrency | ✅ | `logic/saver.ts` saves the whole reachable graph in one transaction: integrity → save-set (graph-modified via `propagateModifications`) → cascade-wire owned child rows (back-ref FK + `@rowOrder`) → topological INSERT/UPDATE → commit-time re-baseline. `logic/graphExplorer.ts`: `exploreModifiables`, `propagateModifications`, `forwardReferences`/`collectionChildren`, `fullIntegrityCheck`, `saveDependencyGraph`. **`ticks` optimistic concurrency live**: UPDATE writes `ticks = old + 1 WHERE id AND ticks = old`, 0 rows → `ConcurrencyException`. **Verified end-to-end** on both dialects (full `MusicLoader.load()` — counts + folder ticks + IBA discriminators). **Snapshot-on-retrieve** via the LINQ `Retriever` — materialised entities are `cleanModified` on load (`isDirty()=false`). **Deferred-FK reference cycles** now handled (`DirectedGraph` + `feedbackEdgeSet` + `Forbidden`), **same-table inserts batched**, **`deleteEntity`** (entity/lite `.delete()` with owned-child cascade) and **collection orphan removal** (snapshot id-list diff) all landed. (`InsertMany`/`UpdateMany` batching intentionally skipped — `BulkInsert` covers the volume case.) |
| **D** Query | `Query<T>` AST, `IQuery`, `flatMap`, `Connector`, `withQuoted` | 🟡 | terminals now async; binder/formatter/reader landed. **Detail in [altea/LINQ-Plan.md](altea/LINQ-Plan.md)** |
| **D** Bulk ops | `executeDelete/Update/Insert` | ✅ | Command nodes + binder + formatter + CommandSimplifier. **All bulk-DML tests green on both dialects**, including `UnsafeUpdatePart`/`UnsafeUpdatePartExpand` (navigated-target UPDATE — joins built *inside* the source subquery, only the FK + referenced values projected, target correlated late via `WHERE target.ID = sN.<fk>`; the old SS "navigated-target" blocker is fixed) and owned-child cascade delete. The few unported cases are C#-only (explicit interface implementation) or by-design (identity insert lives in BulkInsert). See [LINQ-Plan.md](altea/LINQ-Plan.md) |
| **D** SQL translator | binder → optimisers → formatter → reader | ✅ | Binder → optimisers → formatter → reader all landed: navigation/JOIN, collections, Lite, ImplementedBy/ImplementedByAll + SmartEqualizer, groupBy/joins, aggregates (incl. ordered `STRING_AGG`), date/time + Math + string SQL functions, table-valued functions, `WithHint`. **Live: 607/607 on both Postgres and SQL Server.** Only out-of-scope non-port left: SqlHierarchyId. Full progress log in [altea/LINQ-Plan.md](altea/LINQ-Plan.md) |
| **E** JSON serializer | `EntitySerializer` | ❌ | |
| **E** `QueryTokenString.nav()` | typed token strings | ❌ | |
| **Aux** Context | `context.node` (AsyncLocalStorage) + `context.browser` | ✅ | not in original plan |
| **Aux** Test env | `@altea/altea-test`: Music entities + MusicLogic/Starter/Loader | 🟡 | schema generation works both dialects; **`MusicStarter.start()` now generates AND loads the full sample graph live — verified on BOTH Postgres and SQL Server** (row counts, folder ticks, durations, IBA discriminators checked). Loader sets `state`/`index`/`year`/`order` that Signum value-type defaults or the Save operation supplied. MList/hierarchy/vector features commented out |
| **Aux** Auth | `@altea/altea-auth`: `UserEntity` ✅, `AuthLogic` empty | 🟡 | low priority |

Legend: ✅ done · 🟡 partial · ❌ not started

---

## Next steps

**Now — close Phase A loose ends** (small, unblock everything downstream):

1. ~~`@uniqueIndexValidator`~~ — **not needed**: uniqueness is a schema `@uniqueIndex` (done in B), not a runtime validator.
2. **FK `xId` convention auto-pairing** — when a field `employee: Lite<T>` has a sibling `employeeId`, link them in `FieldInfo` automatically (today only the explicit `@fkProperty('…')` override works).
3. **A mixin usage example/test** — exercise `@mixin` + `.mixin<M>()` end to end so the pattern is proven before schema depends on it.
4. ~~`toLite()` / `isDirty()` stay stubs~~ — **done**: both are real now (snapshot change tracking landed in **C**).

**Then — finish the entity round-trip (C) or push the LINQ translator (D).** Save + retrieve + delete all work (a full save→load→re-save→delete cycle runs against a live DB). Saver hardening done: **deferred-FK reference cycles** (DirectedGraph + Forbidden), **batched same-table inserts**, **BulkInsert** (connector SqlBulkCopy/COPY + query-back-by-key), **`deleteEntity`** (entity/lite `.delete()` with owned-child cascade), and **collection orphan removal** (a child dropped from a collection is deleted on save, via a snapshot id-list diff). (InsertMany/UpdateMany batching intentionally skipped — bulk paths cover the volume case.) The **Schema Synchronizer** is also comprehensive (schemas/tables/columns/FK/indexes/enums/views/functions all diff + round-trip). Phases A–D are essentially complete and the narrow query-operator gaps are cleared — `UnsafeUpdatePart` (navigated-target UPDATE), `EvaluateBeforeAfter` (String before/after helpers), `WithHint` (SQL Server table hints), and non-constant string search (contains/startsWith/endsWith now translate to `CHARINDEX`/`strpos` like Signum) all landed. The only remaining query item is **SqlHierarchyId**, an out-of-scope non-port (needs a `hierarchyid` type + `LabelEntity.Node`). Remaining framework work is **Phase E** (JSON serializer, QueryToken) and the small **FK `xId` auto-pairing** loose end above.

---

## LINQ provider build plan (D — active)

**Moved.** The full LINQ provider plan — strategy, decisions, pass/build order,
the file & test mappings, and the Step 0→6 progress log — now lives in
[altea/LINQ-Plan.md](altea/LINQ-Plan.md). That is the canonical home for Phase
**D** work; this file keeps only the one-line **D** rows in the Status table
above.

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
| `@implementedByAll` discriminator | the type column holds the target's **`TypeEntity` int id** (`TypeLogic.typeToId`), like Signum. `TypeEntity` is a real system table (`logic/typeLogic.ts` + `entities/typeEntity.ts`): one row per entity type, ids assigned **deterministically in memory** (sorted by ctor name) and seeded at generation — no DB read-back, since there is no Synchronizer yet ("no Sync"). `TypeLogic` exposes `typeToId`/`getType(id)`/`idToEntity` (the `Map<PrimaryKey, TypeEntity>`); the reader resolves the id → ctor on materialisation |
| Nullable embedded columns | a nullable embedded (`X | null`) forces **all** its flattened sub-columns nullable regardless of the sub-field's own nullability — presence is tracked by the `hasValue` column, and an absent embedded leaves every sub-column NULL |
| Temporal value formatting | save normalizes Temporal types to dialect-portable strings: datetime/time capped at millisecond precision (native nanoseconds overflow SQL Server `datetime2(7)`), `Duration` rendered as clock `HH:MM:SS` (both SQL Server `time` and Postgres `interval` accept it; `"PT4M54S"` does not). Unsized string columns render unbounded so SQL Server doesn't silently truncate at `nvarchar(1)` |
| Value-type defaults | the loader (a port of C# that relied on value-type zero defaults) leans on entity-field initializers for non-null `int` fields it leaves unset (`index`, `AwardNomination.year`/`order`); `state` is set explicitly since Signum's Save *operation* set it |
| Save ordering | `Saver` walks the graph from the root(s), saves the reachable **self-modified** entities only, ordered by FK dependency (`forwardReferences`): an entity is written once everything it points at has an id. Owned collection rows are cascade-wired first (back-ref FK set to the owner *entity* so its live id is read at INSERT, `@rowOrder` set from array index) and so depend on the owner. Existing/clean references need no ordering (their id predates the save). Reference cycles throw for now (no deferred-FK pass yet) |
| SQL translator pipeline | mirror Signum `Engine/Linq/`: QueryBinder → optimisers → QueryFormatter → TranslatorBuilder → ProjectionReader (detail in [altea/LINQ-Plan.md](altea/LINQ-Plan.md)) |

---

## Open questions

- **Next big slice:** Schema+Save (B→C) or LINQ translator (D)? Translator can't materialise results without the schema layer, which argues B→C first.
- **DB dialects:** still targeting both SqlServer and Postgres for the generator/formatter, or pick one first?
- **`altea-auth`:** when does auth logic become real work vs. staying a placeholder?
