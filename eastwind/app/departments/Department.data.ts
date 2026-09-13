// `field` / `registerType` are what the quote-transformer stamps onto each reflected member and onto the
// class itself. It AUGMENTS an existing import from this module rather than adding one, so a data file with
// no other reflection import has to name them — otherwise the emitted decorators are undefined at runtime.
import { field, registerType } from "@altea/altea/data/reflection";
import { entity } from "@altea/altea/data/decorators";
import { stringLengthValidator } from "@altea/altea/data/validators";
import { TreeEntity } from "@altea/altea-tree/data/Tree";

// The app's TREE type — @altea/altea-tree's demo, and the only concrete `TreeEntity` in the repo.
//
// Southwind does NOT use Signum.Tree, so this has no counterpart to port: a tree type is the one thing a
// tree module cannot ship itself (the module supplies the engine, the app supplies the domain), and without
// one the module's pages, its omnibox suggestion and its dashboard part are all unreachable. A department
// hierarchy is the smallest thing that is genuinely a tree and collides with nothing in Northwind —
// Region/Territory is already modelled flat in `employees/`, as Southwind models it.
//
// A tree type declares only its OWN fields: `route` / `parentRoute` / `level` / `name` / `fullName` and the
// two positioning fields come from TreeEntity, and every operation comes from `withTree()`.
@entity("Main", "Master")
export class DepartmentEntity extends TreeEntity {

    @stringLengthValidator({ max: 200 })
    responsible: string | null = null;
}
