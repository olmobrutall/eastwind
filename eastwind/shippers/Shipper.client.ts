import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { ShipperEntity } from "./Shipper.data";

// Shippers domain client.
export namespace ShippersClient {
    export function start(cb: ClientBuilder): void {
        cb.configure(ShipperEntity)
            .withQuerySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.companyName),
                    token(a => a.phone),
                ],
            }));
    }
}
