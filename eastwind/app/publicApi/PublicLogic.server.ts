import "@altea/altea/server";
import { WebBuilder, CustomType } from "@altea/altea/server/webApi";
import { retrieve } from "@altea/altea/server/Database";
import { table } from "@altea/altea/server/table";
import { entityIntegrityCheckAsync } from "@altea/altea/data/validation";
import { Operations } from "@altea/altea/server/operationLogic";
import { PasswordEncoding } from "@altea/altea/server/passwordEncoding";
import { AuthLogic } from "@altea/altea-auth/server/AuthLogic";
import { UserEntity, UserState, UserOperation } from "@altea/altea-auth/data/User";
import { RoleEntity } from "@altea/altea-auth/data/Role";
import { EmployeeEntity, EmployeeOperation } from "../employees/Employee.data";
import { AddressEmbedded } from "../customers/Customer.data";
import { UserEmployeeMixin } from "../globals/UserEmployeeMixin.data";
import { RegisterUserModel, RegisterUserMessage } from "./RegisterUser.data";

// The two ANONYMOUS endpoints
// behind the self-service registration page (publicApi/RegisterUser.tsx).
//
// The registration half does one thing, register the model for reflection, and
// altea's counterpart is the `@reflect` on the model itself (see RegisterUser.data.ts) — so what is left
// here is the controller, which altea writes as routes on the WebBuilder.
//
// Worth knowing:
//  - the ROLE the new user is given is a parameter, not the string literal `"Standard user"` buried in the
//    controller. Which role a self-registered visitor gets is a deployment decision and the one thing here
//    with a security consequence; the Starter passes it.
//  - `[ValidateModelFilter]` becomes an explicit `entityIntegrityCheckAsync` + `res.modelState(...)`, which
//    is what altea's own /api/validateEntity does. Without it the model's validators — including the
//    password minimum — would only be enforced in the browser.
//  - the password is salted with the name the user will actually LOG IN with, rather than with
//    `model.Username` while storing `UserName = model.EMail`, and the salt IS the user name
//    (PasswordEncoding.hashPassword(usernameForSalt, …)) — so the hash it writes is one login can never
//    reproduce, and every registered account is locked out of the front door it was just handed. Fixed
//    rather than mirrored: `model.username` is kept as a member (it is part of the model and its
//    translations) but it is not what the account is keyed by.
//  - the writes run as the SYSTEM user, so the
//    rows are attributable; the reportsTo lookup runs with authorization DISABLED, because an anonymous
//    visitor may not read employees.
export namespace PublicLogic {

    export function start(ws: WebBuilder, options: { registeredUserRoleName: string }): void {

        // A POST with no body — it is a read, but keeping the verb keeps the two clients interchangeable.
        ws.post("/api/getRegisterUser",
            { res: RegisterUserModel, allowAnonymous: true },
            async (req, res) => {
                const reportsToEmployeeId = req.query["reportsToEmployeeId"] as string | undefined;

                // An anonymous visitor has no read access to employees, and the id came from a link an
                // employee handed out — so the lookup is deliberately unauthorized.
                const reportsTo = await AuthLogic.withDisabled(async () =>
                    reportsToEmployeeId == null || reportsToEmployeeId === ""
                        ? null
                        : (await retrieve(EmployeeEntity, EmployeeEntity.parseId(reportsToEmployeeId))).toLite());

                res.jsonTyped(RegisterUserModel.create({
                    reportsTo,
                    address: AddressEmbedded.create({}),
                }));
            });

        // Anonymous, and model-validated before the handler runs.
        ws.post("/api/registerUser",
            { req: RegisterUserModel, allowAnonymous: true },
            async (req, res) => {
                const model = await req.jsonTyped();

                // Validate exactly as a save would and answer a 400
                // ModelState, which the page turns back into per-field errors.
                const ic = await entityIntegrityCheckAsync(model, "Saving");
                if (ic) { res.modelState(ic); return; }

                await AuthLogic.asSystemUser(async () => {
                    const role = await table(RoleEntity)
                        .filter(r => r.name === options.registeredUserRoleName)
                        .singleOrNull() as RoleEntity | null;

                    if (role == null)
                        throw new Error(`The role '${options.registeredUserRoleName}' does not exist`);

                    const already = await table(UserEntity).count(u => u.userName === model.eMail) > 0;
                    if (already)
                        throw new Error(RegisterUserMessage.user0IsAlreadyRegistered.niceToString(model.eMail));

                    const employee = EmployeeEntity.create({
                        titleOfCourtesy: model.titleOfCourtesy,
                        firstName: model.firstName,
                        lastName: model.lastName,
                        reportsTo: model.reportsTo,
                        address: model.address,
                    });
                    await Operations.execute(employee, EmployeeOperation.Save);

                    const user = UserEntity.create({
                        userName: model.eMail,
                        // See the header: the salt must be the name login will present.
                        passwordHash: PasswordEncoding.hashPassword(model.eMail, model.password),
                        email: model.eMail,
                        state: UserState.Active,
                        role: role.toLite(),
                    });
                    // altea inlines a mixin's fields onto the owner, so setting one is a plain
                    // assignment through the typed `mixin()` cast — the call employeeLoader already makes.
                    user.mixin(UserEmployeeMixin).employee = employee.toLite();
                    await Operations.execute(user, UserOperation.Save);
                });

                res.status(200).end();
            });
    }
}
