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
| **A** Entity model | `BaseEntity`(`.init`/`.mixin`) + `@reflect`, `Entity`, `Embedded/ModelEntity`, `Lite`/`LiteImp`, `PrimaryKey` | ✅ | `toLite()` throws, `isDirty()` stubbed — both wait on B/C |
| **A** Transformer v2 | auto-`@field`, two-arg generics (`Lite<T>`/`Array<T>`), `@quoted` capture | ✅ | well tested |
| **A** Decorators/validators | `@field`, string/url/tel/email/noRepeat validators, `@ignore`, `@fkProperty`, `@implementedBy(All)`, `@entity`, `EntityKind`, `EntityData` | ✅ | `@uniqueIndexValidator` **missing** |
| **A** FK dual props | `@fkProperty` override + `FieldInfo.fkPropertyName` | 🟡 | `xId` naming-convention auto-pairing **not** done |
| **A** Mixins | `@mixin`, `MixinDeclarations.register`, `.mixin<M>()` cast | ✅ | no usage example yet |
| **B** Schema/Table | `Table`, `Column`, `ObjectName`, `@column` | 🟡 | data structures only |
| **B** Field hierarchy | `FieldValue/Reference/ImplementedBy/Embedded/MList…` | ❌ | |
| **B** `SchemaBuilder`/`EntityBuilder` | fluent `include()`/`withQuery()`/… | ❌ | |
| **B** Schema generator (DDL) | `Schema` → CREATE SCHEMA/TABLE/FK | ✅ | `SqlPreCommand`, `SqlBuilder` (both dialects), `Schema.generating` event chain + `generationScript()`. Indexes pending (no index model yet); string columns emit no length default |
| **B** Connectors | `Connector.current`/`default`, `SqlServerConnector` (mssql), `PostgresConnector` (pg) | ✅ | ambient via `context.node`; live execution (`executeScript`/`executeNonQuery`/`executeQuery`) |
| **B** Schema synchronizer | introspect → diff → `SyncScript` | ❌ | next: introspection + diff |
| **C** Snapshot/change detection | `takeSnapshot`, `diffSnapshot`, real `isDirty` | 🟡 | `_snapshot` field exists only |
| **C** Save/ORM | `save`/`load`/`tryLoad`/`deleteEntity`, `GraphExplorer` | ❌ | |
| **D** Query | `Query<T>` AST, `IQuery`, `flatMap`, `Connector`, `withQuoted` | 🟡 | translator stubbed; `withExpressionFrom` missing. `Connector` now real (see **B** Connectors) |
| **D** Bulk ops | `executeDelete/Update/Insert` | ❌ | |
| **D** SQL translator | Expression AST + `ExpressionSimplifier` ✅; `DbExpression`, QueryBinder, QueryFormatter, ProjectionReader ❌ | 🟡 | AST + one optimiser visitor exist |
| **E** JSON serializer | `EntitySerializer` | ❌ | |
| **E** `QueryTokenString.nav()` | typed token strings | ❌ | |
| **Aux** Context | `context.node` (AsyncLocalStorage) + `context.browser` | ✅ | not in original plan |
| **Aux** Test env | `@altea/altea-test`: Music entities + MusicLogic/Starter/Loader | 🟡 | schema generation works both dialects; `Loader` builds in-memory graph (save pending). MList/hierarchy/vector features commented out |
| **Aux** Auth | `@altea/altea-auth`: `UserEntity` ✅, `AuthLogic` empty | 🟡 | low priority |

Legend: ✅ done · 🟡 partial · ❌ not started

---

## Next steps

**Now — close Phase A loose ends** (small, unblock everything downstream):

1. **`@uniqueIndexValidator`** — add to `entities/validators.ts` + `decorators.ts` alongside the existing validators.
2. **FK `xId` convention auto-pairing** — when a field `employee: Lite<T>` has a sibling `employeeId`, link them in `FieldInfo` automatically (today only the explicit `@fkProperty('…')` override works).
3. **A mixin usage example/test** — exercise `@mixin` + `.mixin<M>()` end to end so the pattern is proven before schema depends on it.
4. (Deferred, not really Phase A) `toLite()` / `isDirty()` stay stubs until the schema + snapshot layers land — leave the `throw`/placeholder but track here.

**Then — pick the next big slice** (open question, see below): Schema+Save (B→C) for a working entity round-trip, or push the LINQ translator (D) since the expression AST already exists.

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
| Change detection | snapshot stores primitives + FK ids only (no deep refs) |
| Bulk ops | `executeDelete/Update/Insert` on `Query<T>`; `deleteEntity` delegates to `executeDelete` |
| SQL translator pipeline | mirror Signum `Engine/Linq/`: QueryBinder → optimisers → QueryFormatter → TranslatorBuilder → ProjectionReader |

---

## Open questions

- **Next big slice:** Schema+Save (B→C) or LINQ translator (D)? Translator can't materialise results without the schema layer, which argues B→C first.
- **DB dialects:** still targeting both SqlServer and Postgres for the generator/formatter, or pick one first?
- **`altea-auth`:** when does auth logic become real work vs. staying a placeholder?
