import "@altea/altea/server"; // installs save()/toLite()
import { table } from "@altea/altea/server/table";
import { PasswordEncoding } from "@altea/altea/server/passwordEncoding";
import { TypeEntity } from "@altea/altea/data/typeEntity";
import { RoleEntity, RoleEntity_InheritsFrom, MergeStrategy } from "@altea/altea-auth/data/Role";
import { UserEntity, UserState } from "@altea/altea-auth/data/User";
import { RuleTypeEntity, TypeAllowed } from "@altea/altea-auth/data/Rules";

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
