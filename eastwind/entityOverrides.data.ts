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
import type { Type } from "@altea/altea/data/entity";
import { ExceptionEntity } from "@altea/altea/data/exception";
import { OperationLogEntity } from "@altea/altea/data/operationLog";
import { UserEntity } from "@altea/altea-auth/data/User";
import { PanelPartEmbedded } from "@altea/altea-dashboard/data/Dashboard";
import {
    TextPartEntity, ImagePartEntity, SeparatorPartEntity, HealthCheckPartEntity, CustomPartEntity,
} from "@altea/altea-dashboard/data/Parts";
import {
    UserQueryPartEntity, ValueUserQueryListPartEntity, BigValuePartEntity,
} from "@altea/altea-user-queries/data/DashboardParts";
import { UserChartPartEntity, CombinedUserChartPartEntity } from "@altea/altea-chart/data/DashboardParts";
import { UserQueryEntity } from "@altea/altea-user-queries/data/UserQuery";
import { UserChartEntity } from "@altea/altea-chart/data/UserChart";
import { DashboardEntity } from "@altea/altea-dashboard/data/Dashboard";
import { QueryEntity } from "@altea/altea/data/queryEntity";
import { PermissionSymbol } from "@altea/altea-auth/data/Rules";
import {
    ToolbarElementBase, ToolbarEntity, ToolbarMenuEntity, ToolbarSwitcherEntity,
} from "@altea/altea-toolbar/data/Toolbar";

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

        // The dashboard PART types this app offers (Southwind did exactly this in Starter.cs:
        // `FieldAttributes((DashboardEntity a) => a.Parts.First().Content).Replace(new ImplementedByAttribute(
        // …))`). The list decides both the pickable part types in the editor and which part TABLES the schema
        // creates — @altea/altea-dashboard declares only its own five, so the modules' parts are added here.
        overrideImplementedBy(PanelPartEmbedded, "content", () => [
            TextPartEntity,
            ImagePartEntity,
            SeparatorPartEntity,
            HealthCheckPartEntity,
            CustomPartEntity,
            UserQueryPartEntity,
            ValueUserQueryListPartEntity,
            BigValuePartEntity,
            UserChartPartEntity,
            CombinedUserChartPartEntity,
        ]);

        // What a TOOLBAR ELEMENT may point at (Signum's `[ImplementedBy()]` empty list, widened by each
        // module's `AssertImplementedBy` from its own Logic.Start). The list decides the pickable content
        // types in the editor, the FK columns of both element tables, AND — in altea — which types get the
        // "delete the elements pointing at me" cascade (see ToolbarLogic.start). Declared on the ABSTRACT
        // base: both concrete element rows inherit that one field, so one call covers ToolbarEntity_Elements
        // and ToolbarMenuEntity_Elements.
        // (`overrideImplementedBy` asks for a concrete Type<T>; the base is abstract, which matters only to
        // the type-checker — the FieldInfo it mutates is the very one both element rows inherit.)
        overrideImplementedBy(ToolbarElementBase as unknown as Type<ToolbarElementBase>, "content", () => [
            QueryEntity,
            PermissionSymbol,
            ToolbarEntity,
            ToolbarMenuEntity,
            ToolbarSwitcherEntity,
            UserQueryEntity,
            UserChartEntity,
            DashboardEntity,
        ]);

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
