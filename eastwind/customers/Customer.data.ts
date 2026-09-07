import { reflect, init } from "@altea/altea/data/reflection";
import { Entity, EmbeddedEntity, ModelEntity } from "@altea/altea/data/entity";
import { Lite } from "@altea/altea/data/lite";
import { entity, quoted, mixin, implementedBy, primaryKey, stringLengthValidator, telephoneValidator } from "@altea/altea/data/decorators";
import { CorruptMixin } from "@altea/altea/data/corruptMixin";
import { Temporal } from "@altea/altea/data/basics";
import type { ExecuteSymbol } from "@altea/altea/data/operations";
import type { SMSOwnerData } from "@altea/altea-sms/data/SMS";

// Port of Southwind's Customers domain (Southwind/Customers/*.cs). CustomerEntity is an ABSTRACT base
// (like the music model's AwardEntity) with two concrete subclasses — Person and Company — reached
// polymorphically. AddressEmbedded lives here (it's a customer concept); Orders imports it.

@reflect
export class AddressEmbedded extends EmbeddedEntity {
    address: string;
    city: string;
    region: string | null;
    postalCode: string | null;
    country: string;

    // Signum's AddressEmbedded.Clone() — a fresh copy (an order snapshots the customer's address).
    clone(): AddressEmbedded {
        return AddressEmbedded.create({
            address: this.address, city: this.city, region: this.region,
            postalCode: this.postalCode, country: this.country,
        });
    }

    @quoted toString(): string { return `${this.address}\n ${this.postalCode} ${this.city} (${this.country})`; }
}

// Signum's abstract CustomerEntity — the shared shape of Person + Company. Never `include`d directly
// (only its concrete subclasses get tables); reached via @implementedBy from OrderEntity.customer.
// Signum's `[PrimaryKey(typeof(Guid))]`: the whole customer hierarchy keys on a GUID (Person/Company
// tables + the OrderEntity.customer FK columns become uuid). Set on the abstract base so both concrete
// subclasses inherit it (their TypeInfo copies this `id` field once this decorator has run).
@reflect
@primaryKey("uuid")
export abstract class CustomerEntity extends Entity {
    address: AddressEmbedded;

    @stringLengthValidator({ min: 3, max: 24 }) @telephoneValidator()
    phone: string;

    @stringLengthValidator({ min: 3, max: 24 }) @telephoneValidator()
    fax: string | null;

    /**
     * Who to text, at which number, in which language — @altea/altea-sms's `SMSOwnerData`. This is the
     * member a query-based SMSTemplate's `to` token points at, and it is exactly the shape Signum's own
     * DynamicType snippet generates (`SMSOwnerDataExpression = @this => new SMSOwnerData { … }`).
     *
     * `@quoted`, so it is a real query TOKEN the template editor can pick and the renderer can select.
     */
    @quoted smsOwnerData(): SMSOwnerData {
        return { owner: this.toLite(), telephoneNumber: this.phone, culture: null };
    }
}

@entity("Shared", "Transactional")
// Southwind's `[Mixin(typeof(CorruptMixin))]` (Customers/PersonEntity.cs) — the person is the app's one
// example of a row that may be saved INVALID (an imported legacy customer with no title or birth date),
// which is what the mixin's `corrupt` flag records. Southwind's own `IsApplicableValidator(p =>
// Corruption.Strict)` on Title / DateOfBirth is the other half; altea has no Corruption scope, so the
// column is carried and the escape hatch is not.
@mixin(() => [CorruptMixin])
export class PersonEntity extends CustomerEntity {
    firstName: string;
    lastName: string;
    title: string | null;
    dateOfBirth: Temporal.PlainDate | null;

    // NOT `@quoted`: Southwind writes a plain `ToString()` here (not an [AutoExpressionField]), so the
    // display string is STORED in a `to_str` column rather than expanded into every query. Company's
    // `As.Expression(() => CompanyName)` right below is the other case, and keeps its @quoted.
    toString(): string { return `${this.firstName} ${this.lastName}`; }
}

@entity("Shared", "Transactional")
export class CompanyEntity extends CustomerEntity {
    companyName: string;
    contactName: string;
    contactTitle: string;

    @quoted toString(): string { return this.companyName; }
}

// Signum's `[AutoInit] static class CustomerOperation { static ExecuteSymbol<CustomerEntity> Save; }`
// (Southwind/Customers/CustomerEntity.cs). ONE Save symbol typed on the abstract CustomerEntity —
// registered once and shared by both concrete customers (Person + Company), matching Southwind's
// `.WithSave(CustomerOperation.Save)` on each. Wired in CustomerLogic.server.ts.
export namespace CustomerOperation {
    export const Save: ExecuteSymbol<CustomerEntity> = init();
}

// The row shape of the manual union query (Signum's anonymous Select projection over Person+Company).
// A ModelEntity, so it's a reflected-but-not-persisted query shape; its fields are the query columns.
@reflect
export class CustomerRowModel extends ModelEntity {
    // The row identity — a lite of the concrete customer (Person or Company).
    @implementedBy(() => [PersonEntity, CompanyEntity])
    entity: Lite<CustomerEntity> = null!;
    id: string = "";
    name: string = "";
    address: AddressEmbedded = null!;
    phone: string = "";
    fax: string | null = null;
}
