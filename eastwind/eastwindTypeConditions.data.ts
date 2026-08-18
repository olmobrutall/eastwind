import { init } from "@altea/altea/data/reflection";
import type { TypeConditionSymbol } from "@altea/altea-auth/data/Rules";

// Port of Southwind's `[AutoInit] static class SouthwindTypeCondition` (Southwind/SouthwindTypeCondition.cs):
// the app's own row-level condition symbols, referenced BOTH by the server (which registers the predicate for
// each entity type — see starter.server.ts) and by the auth-rules admin UI (which offers them per role).
//
// `UserEntities`  — the row belongs to the current USER (a personal dashboard / user query / user chart).
// `RoleEntities`  — the row is global (no owner) or owned by one of the current user's ROLES (shared).
//
// A symbol only bites once a role has a condition RULE using it (seeded in terminal/eastwindMigrations.ts for
// "Standard user", editable in the Role → Type rules UI).
export namespace EastwindTypeCondition {
    export const UserEntities: TypeConditionSymbol = init();
    export const RoleEntities: TypeConditionSymbol = init();
}
