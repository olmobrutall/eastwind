import { Finder } from "@altea/altea/client/Finder";
import { ShipperEntity } from "eastwind/entities/shippers";

// Shippers domain client.
export namespace ShippersClient {
    export function start(): void {
        Finder.addSettings(
            ShipperEntity.querySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.companyName),
                    token(a => a.phone),
                ],
            })),
        );
    }
}
