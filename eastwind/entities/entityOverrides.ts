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
export namespace EntityOverrides {
    export function start(): void {
        // MixinDeclarations.register(EmployeeEntity, ColaboratorsMixin);
        // registerCustomLite(EmployeeEntity, EmployeeLite, e => EmployeeLite.create({ ... }), /*isDefault*/ true);
        // (implementedBy overrides, when a field's implementations must change from another module)
    }
}
