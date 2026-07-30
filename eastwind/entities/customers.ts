import { reflect } from "@altea/altea/entities/reflection";
import { Entity, EmbeddedEntity, ModelEntity } from "@altea/altea/entities/entity";
import { Lite } from "@altea/altea/entities/lite";
import { entity, quoted, implementedBy } from "@altea/altea/entities/decorators";
import { Temporal } from "@altea/altea/entities/basics";

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
}

// Signum's abstract CustomerEntity — the shared shape of Person + Company. Never `include`d directly
// (only its concrete subclasses get tables); reached via @implementedBy from OrderEntity.customer.
@reflect
export abstract class CustomerEntity extends Entity {
    address: AddressEmbedded;
    phone: string;
    fax: string | null;
}

@entity("Shared", "Transactional")
export class PersonEntity extends CustomerEntity {
    firstName: string;
    lastName: string;
    title: string | null;
    dateOfBirth: Temporal.PlainDate | null;

    @quoted toString(): string { return `${this.firstName} ${this.lastName}`; }
}

@entity("Shared", "Transactional")
export class CompanyEntity extends CustomerEntity {
    companyName: string;
    contactName: string;
    contactTitle: string;

    @quoted toString(): string { return this.companyName; }
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
