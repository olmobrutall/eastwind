// EntityOverrides — the shared client+server home for static, per-model declarations that BOTH tiers
// must apply before any entity is (de)serialized or any schema/UI is built:
//   - mixin registration          (Signum's MixinDeclarations.Register)
//   - lite-model constructors      (Signum's [LiteModel] / registerCustomLite)
//   - implementedBy overrides      (Signum's [ImplementedBy] override / OverrideAttributes)
//
// These are NOT shipped by the /api/reflection/metadata endpoint: they are identical for every user and
// culture, and the entity serializer needs mixins + implementedBy to reconstruct graphs — so they must
// exist before the metadata response can even be parsed. Living here (the shared entities layer) means
// the server Starter and the client bootstrap run the exact same declarations.
//
// Empty today: eastwind registers no mixins, every lite model is the default, and implementedBy is
// declared inline via @implementedBy on OrderEntity.customer. As those needs arise, register them here.
import { overrideImplementedBy } from "@altea/altea/data/decorators";
import { ExceptionEntity } from "@altea/altea/data/exception";
import { OperationLogEntity } from "@altea/altea/data/operationLog";
import { UserEntity } from "@altea/altea-auth/data/User";

export namespace EntityOverrides {
    export function start(): void {
        // MixinDeclarations.register(EmployeeEntity, ColaboratorsMixin);
        // registerCustomLite(EmployeeEntity, EmployeeLite, e => EmployeeLite.create({ ... }), /*isDefault*/ true);

        // implementedBy overrides (Signum's OverrideAttributes): the framework's ExceptionEntity /
        // OperationLogEntity declare `user` with NO implementations (so altea core needn't reference
        // altea-auth); the app points them at its concrete UserEntity. Runs on both tiers before any
        // (de)serialization or schema build.
        overrideImplementedBy(ExceptionEntity, "user", () => [UserEntity]);
        overrideImplementedBy(OperationLogEntity, "user", () => [UserEntity]);

        // Package / folder defaults (Signum's assembly [DefaultAssemblyCulture] + default schema). Written
        // as bare calls that the quote-transformer stamps with the file's __fileInfo, so they know the
        // package + directory they were declared in:
        //   setDefaultCulture("en");           // the language this package's code-declared strings are in
        //   setDefaultDatabaseSchema("dbo");   // the schema this folder's tables land in (server-only)
        // `setDefaultCulture` is package-wide; `setDefaultDatabaseSchema` is FOLDER-scoped — put one at the
        // top of a sub-folder's module (e.g. entities/sales/…) to override the package default for just
        // that folder, and the most specific directory wins.
    }
}
