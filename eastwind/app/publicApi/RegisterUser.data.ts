import { reflect } from "@altea/altea/data/reflection";
import { ModelEntity } from "@altea/altea/data/entity";
import type { Lite } from "@altea/altea/data/lite";
import { validate, stringLengthValidator, emailValidator } from "@altea/altea/data/validators";
import { msg } from "@altea/altea/data/utils/localization";
import { niceName } from "@altea/altea/data/decorators";
import { LoginAuthMessage } from "@altea/altea-auth/data/AuthMessages";
import { AddressEmbedded } from "../customers/Customer.data";
import { EmployeeEntity } from "../employees/Employee.data";

// The SELF-SERVICE registration form: an anonymous
// visitor fills it in and the app creates an Employee plus the User that logs in as them (see
// PublicLogic.server.ts).
//
// altea needs no allow-unauthenticated marker. Such an attribute opts a type into the reflection
// payload an unauthenticated caller receives; altea's metadata blob already ships every registered type's
// nice names and is role-filtered only over the SCHEMA's tables (AuthReflection) — a ModelEntity has none,
// so it reaches an anonymous visitor as it stands. `@reflect` is what the
// an allow-unauthenticated marker would do: register the type at all.
@reflect
export class RegisterUserModel extends ModelEntity {
    /** The employee the new one reports to — pre-filled from the url when the page is opened from an
     *  employee's quick link, and shown READ-ONLY (there is no picker for an anonymous visitor). */
    reportsTo: Lite<EmployeeEntity> | null;

    @stringLengthValidator({ max: 100 })
    titleOfCourtesy: string;

    @stringLengthValidator({ max: 100 })
    firstName: string;

    @stringLengthValidator({ max: 100 })
    lastName: string;

    address: AddressEmbedded;

    @stringLengthValidator({ max: 100 })
    username: string;

    @niceName("E-Mail")
    @stringLengthValidator({ max: 100 })
    @emailValidator()
    eMail: string;

    // The password rule. altea has no such
    // static hook (AuthServer keeps the same rule as a private `validatePassword`), and the rule is one
    // line, so it is written here as the field's own validator — which is also what makes it run on the
    // CLIENT, so the visitor is told before submitting.
    @validate<RegisterUserModel>(m => m.password != null && m.password.length < MIN_PASSWORD_LENGTH
        ? LoginAuthMessage.ThePasswordMustHaveAtLeast0Characters.niceToString(MIN_PASSWORD_LENGTH)
        : null)
    password: string;
}

/** The password minimum, mirrored on both tiers (AuthServer enforces the same
 *  number for a password change). */
export const MIN_PASSWORD_LENGTH = 5;

// A MESSAGE container rather than a reflected
// enum, as every eastwind message container is: its text lives in the translation files, which the
// reflection endpoint already serves anonymously.
export const RegisterUserMessage = {
    pleaseFillTheFollowingFormToRegisterANewEastwindEmployee:
        msg("Please fill the following form to register a new Eastwind Employee"),
    register: msg("Register"),
    userRegistered: msg(),
    user0HasBeenRegisteredSuccessfully: msg("User {0} has been registered successfully!"),
    goToLoginPage: msg("Go to Login page"),
    user0IsAlreadyRegistered: msg("User {0} is already registered"),
};
