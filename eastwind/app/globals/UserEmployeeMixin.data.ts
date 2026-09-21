import { MixinEntity } from "@altea/altea/data/entity";
import { reflect } from "@altea/altea/data/reflection";
import type { Lite } from "@altea/altea/data/lite";
import { EmployeeEntity } from "../employees/Employee.data";

// The link from a login to the EMPLOYEE behind it,
// which is what `EmployeeEntity.current()` reads (through the "Employee" claim, filled in entityOverrides)
// so an order created by Steven is stamped with Steven's employee row.
//
// altea divergence: mixin fields are INLINED onto the owner (see @altea/altea-diff-log's DiffLogMixin), so
// this becomes UserEntity's own field and its column is FLATTENED (`employee_id` on the user table).
// Reading it through `user.mixin(UserEmployeeMixin)` still works and is what the port does, so the call
// sites read naturally — but an existing database needs a `terminal sync` before the column exists.
//
// It is DECLARED on UserEntity in eastwind's entityOverrides, which is where
// `MixinDeclarations.Register<UserEntity, UserEmployeeMixin>()`.
@reflect
export class UserEmployeeMixin extends MixinEntity {
    employee: Lite<EmployeeEntity> | null;
}
