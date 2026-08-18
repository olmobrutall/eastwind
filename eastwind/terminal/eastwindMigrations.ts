import "@altea/altea/server"; // installs save()/toLite()
import { table } from "@altea/altea/server/table";
import { PasswordEncoding } from "@altea/altea/server/passwordEncoding";
import { TypeEntity } from "@altea/altea/data/typeEntity";
import type { Lite } from "@altea/altea/data/lite";
import { toInt } from "@altea/altea/data/basics";
import { RoleEntity, RoleEntity_InheritsFrom, MergeStrategy } from "@altea/altea-auth/data/Role";
import { UserEntity, UserState } from "@altea/altea-auth/data/User";
import {
    RuleTypeEntity, RuleTypeConditionEntity, RuleTypeConditionEntity_Conditions, RulePermissionEntity,
    TypeAllowed, TypeConditionSymbol, PermissionSymbol,
} from "@altea/altea-auth/data/Rules";
import { EastwindTypeCondition } from "../eastwindTypeConditions.data";

// Port of Southwind.Terminal/SouthwindMigrations — the auth-setup migration steps:
//   • createRoles       — Southwind's CreateRoles (AuthLogic.LoadRoles + the AuthRules.xml role graph):
//                         Anonymous, Standard user, Super user (Intersection), Advanced user ⊃ Standard.
//   • createSystemUser  — Southwind's CreateSystemUser: the "System" (Super user) + "Anonymous" users.
//   • importAuthRules   — Southwind's InitialAuthRulesImport → AuthLogic.AutomaticImportAuthRules
//                         (AuthRules.xml, not ported): stand-in granting Standard user Read on the
//                         Northwind domain types so roles differ visibly.
// (Southwind's EmployeeLoader.CreateUsers lives in the employee loader — see employeeLoader.ts.)
// Passwords equal the username (Southwind's HashPassword(name, name)) — dev only. Idempotent.
export namespace EastwindMigrations {
    const DOMAIN_TYPES = ["Order", "Product", "Person", "Company", "Employee", "Shipper", "Supplier", "Category", "Region", "Territory"];
    // Row-scoped instead of plainly readable — see importAuthRules.
    const USER_ASSET_TYPES = ["Dashboard", "UserQuery", "UserChart"];
    // The feature permissions the user-asset routes assert (Signum keys them "<Container>.<Member>").
    const USER_ASSET_PERMISSIONS = [
        "DashboardPermission.ViewDashboard",
        "UserQueryPermission.ViewUserQuery",
        "ChartPermission.ViewCharting",
        "UserAssetPermission.UserAssetsToXML",
    ];

    export async function createRoles(): Promise<void> {
        await ensureRole("Anonymous", MergeStrategy.Union, []);
        const standard = await ensureRole("Standard user", MergeStrategy.Union, []);
        await ensureRole("Super user", MergeStrategy.Intersection, []);
        await ensureRole("Advanced user", MergeStrategy.Union, [standard]);
    }

    export async function createSystemUser(): Promise<void> {
        await ensureUser("System", "Super user");
        await ensureUser("Anonymous", "Anonymous");
    }

    export async function importAuthRules(): Promise<void> {
        const standard = await table(RoleEntity).filter(r => r.name == "Standard user").singleOrNull() as RoleEntity | null;
        if (standard == null)
            return;
        const roleLite = standard.toLite();
        const byClean = new Map((await table(TypeEntity).toArray() as TypeEntity[]).map(t => [t.cleanName, t]));
        const existing = await table(RuleTypeEntity).filter(rt => rt.role == roleLite).toArray() as RuleTypeEntity[];
        const haveTypeIds = new Set(existing.map(rt => rt.resource.id));
        for (const clean of DOMAIN_TYPES) {
            const type = byClean.get(clean);
            if (type == null || haveTypeIds.has(type.id))
                continue;
            await RuleTypeEntity.create({ role: roleLite, resource: type.toLite(), fallback: TypeAllowed.Read }).save();
        }

        // The user-asset FEATURES themselves (Southwind's AuthRules.xml grants these to Standard user): without
        // them the module routes 403 before any row scoping is even consulted.
        for (const permission of USER_ASSET_PERMISSIONS)
            await ensurePermission(roleLite, permission);

        // The USER-ASSET types are row-scoped instead of plainly readable (Southwind's AuthRules.xml does the
        // same with SouthwindTypeCondition): NO access by default, plus one condition rule per owner kind —
        // Read when the asset is the current user's, Read when it is global / owned by one of their roles.
        // (Last match wins, so the two rules are independent grants.) Parts — panel parts, filter rows,
        // token equivalences — inherit these rules structurally, so they need no rules of their own.
        const userEntities = await symbolLite(EastwindTypeCondition.UserEntities.key);
        const roleEntities = await symbolLite(EastwindTypeCondition.RoleEntities.key);
        if (userEntities == null || roleEntities == null)
            return; // symbols not seeded yet (run `sync` first)

        for (const clean of USER_ASSET_TYPES) {
            const type = byClean.get(clean);
            if (type == null || haveTypeIds.has(type.id))
                continue;

            await RuleTypeEntity.create({
                role: roleLite,
                resource: type.toLite(),
                fallback: TypeAllowed.None,
                conditionRules: [
                    conditionRule(0, userEntities),
                    conditionRule(1, roleEntities),
                ],
            }).save();
        }
    }

    /** Grant a permission to a role, unless it already has an explicit rule for it. */
    async function ensurePermission(roleLite: Lite<RoleEntity>, key: string): Promise<void> {
        const symbol = await table(PermissionSymbol).filter(s => s.key == key).singleOrNull() as PermissionSymbol | null;
        if (symbol == null)
            return; // not seeded yet (run `sync` first)

        const symbolLite = symbol.toLite() as Lite<PermissionSymbol>;
        const existing = await table(RulePermissionEntity)
            .filter(rp => rp.role == roleLite && rp.resource == symbolLite).singleOrNull();
        if (existing != null)
            return;

        await RulePermissionEntity.create({ role: roleLite, resource: symbolLite, allowed: true }).save();
    }

    function conditionRule(order: number, symbol: Lite<TypeConditionSymbol>): RuleTypeConditionEntity {
        return RuleTypeConditionEntity.create({
            order: toInt(order),
            allowed: TypeAllowed.Read,
            conditions: [RuleTypeConditionEntity_Conditions.create({ symbol })],
        });
    }

    async function symbolLite(key: string): Promise<Lite<TypeConditionSymbol> | null> {
        const row = await table(TypeConditionSymbol).filter(s => s.key == key).singleOrNull() as TypeConditionSymbol | null;
        return row == null ? null : row.toLite() as Lite<TypeConditionSymbol>;
    }

    async function ensureRole(name: string, strategy: MergeStrategy, inheritsFrom: RoleEntity[]): Promise<RoleEntity> {
        let role = await table(RoleEntity).filter(r => r.name == name).singleOrNull() as RoleEntity | null;
        if (role == null) {
            role = RoleEntity.create({
                name,
                mergeStrategy: strategy,
                inheritsFrom: inheritsFrom.map(r => RoleEntity_InheritsFrom.create({ inheritsFrom: r.toLite() })),
            });
            await role.save();
        }
        return role;
    }

    async function ensureUser(userName: string, roleName: string): Promise<void> {
        const existing = await table(UserEntity).filter(u => u.userName == userName).singleOrNull() as UserEntity | null;
        if (existing != null)
            return;
        const role = await table(RoleEntity).filter(r => r.name == roleName).singleOrNull() as RoleEntity | null;
        if (role == null)
            return;
        await UserEntity.create({
            userName,
            role: role.toLite(),
            state: UserState.Active,
            passwordHash: PasswordEncoding.hashPassword(userName, userName),
        }).save();
    }
}
