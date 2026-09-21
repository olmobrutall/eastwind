import { reflect, init } from "@altea/altea/data/reflection";
import { Entity, EmbeddedEntity, ModelEntity } from "@altea/altea/data/entity";
import { Lite } from "@altea/altea/data/lite";
import { entity, quoted, mixin, implementedBy, primaryKey } from "@altea/altea/data/decorators";
import { stringLengthValidator, telephoneValidator, validate, ValidationMessage } from "@altea/altea/data/validators";
import { CorruptMixin } from "@altea/altea/data/corruptMixin";
import { Temporal } from "@altea/altea/data/basics";
import type { ExecuteSymbol } from "@altea/altea/data/operations";
import type { SMSOwnerData } from "@altea/altea-sms/data/SMS";

// The Customers domain. CustomerEntity is an ABSTRACT base with two concrete subclasses — Person and
// Company — reached polymorphically. AddressEmbedded lives here (it's a customer concept); Orders imports
// it.

@reflect
export class AddressEmbedded extends EmbeddedEntity {
    @stringLengthValidator({ min: 3, max: 60, multiLine: true })
    address: string;
    @stringLengthValidator({ min: 3, max: 15 })
    city: string;
    @stringLengthValidator({ min: 2, max: 15 })
    region: string | null;
    // A postal code is mandatory everywhere except Ireland, which has (had) none. The field stays
    // NULLABLE — the rule is about the country, not about the column — so it is a `@validate`, not a
    // `@notNullValidator`.
    @validate<AddressEmbedded>((a, fi) => (a.postalCode ?? "") === "" && a.country !== "Ireland"
        ? ValidationMessage._0IsNotSet.niceToString(fi.niceToString())
        : null)
    @stringLengthValidator({ min: 3, max: 10 })
    postalCode: string | null;
    @stringLengthValidator({ min: 2, max: 15 })
    country: string;

    // A fresh copy: an order snapshots the customer's address.
    clone(): AddressEmbedded {
        return AddressEmbedded.create({
            address: this.address, city: this.city, region: this.region,
            postalCode: this.postalCode, country: this.country,
        });
    }

    @quoted toString(): string { return `${this.address}\n ${this.postalCode} ${this.city} (${this.country})`; }
}

// The shared shape of Person + Company. Never `include`d directly (only its concrete subclasses get
// tables); reached via @implementedBy from OrderEntity.customer.
//
// The whole customer hierarchy keys on a GUID (Person/Company tables + the OrderEntity.customer FK columns
// become uuid). Set on the abstract base so both concrete subclasses inherit it (their TypeInfo copies
// this `id` field once this decorator has run).
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
     * member a query-based SMSTemplate's `to` token points at.
     *
     * `@quoted`, so it is a real query TOKEN the template editor can pick and the renderer can select.
     */
    @quoted smsOwnerData(): SMSOwnerData {
        return { owner: this.toLite(), telephoneNumber: this.phone, culture: null };
    }
}

@entity("Shared", "Transactional")
// The person is the app's one example of a row that may be saved INVALID (an imported legacy customer
// with no title or birth date), which is what the mixin's `corrupt` flag records. altea has no Corruption
// SCOPE, so the column is carried and the per-property escape hatch is not.
@mixin(() => [CorruptMixin])
export class PersonEntity extends CustomerEntity {
    @stringLengthValidator({ min: 3, max: 40 })
    firstName: string;
    @stringLengthValidator({ min: 3, max: 40 })
    lastName: string;
    @stringLengthValidator({ min: 2, max: 10 })
    title: string | null;
    dateOfBirth: Temporal.PlainDate | null;

    // NOT `@quoted`: the display string is STORED in a `to_str` column rather than expanded into every
    // query. Company's right below is the other case, and keeps its @quoted.
    toString(): string { return `${this.firstName} ${this.lastName}`; }
}

@entity("Shared", "Transactional")
export class CompanyEntity extends CustomerEntity {
    @stringLengthValidator({ min: 3, max: 40 })
    companyName: string;
    @stringLengthValidator({ min: 3, max: 30 })
    contactName: string;
    @stringLengthValidator({ min: 3, max: 30 })
    contactTitle: string;

    @quoted toString(): string { return this.companyName; }
}

// ONE Save symbol typed on the abstract CustomerEntity — registered once and shared by both concrete
// customers (Person + Company). Wired in CustomerLogic.server.ts.
export namespace CustomerOperation {
    export const Save: ExecuteSymbol<CustomerEntity> = init();
}

// The row shape of the manual union query over Person + Company.
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
