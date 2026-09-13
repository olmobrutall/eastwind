import { ClientBuilder } from "@altea/altea/client/ClientBuilder";
import { getTypeInfo } from "@altea/altea/client/Reflection";
import { TreeClient } from "@altea/altea-tree/client/TreeClient";
import { DepartmentEntity } from "./Department.data";

// Departments domain client — the tree demo's client half.
export namespace DepartmentsClient {
    export function start(cb: ClientBuilder): void {

        cb.configure(DepartmentEntity)
            .withQuerySettings(token => ({
                defaultColumns: [
                    token(a => a.id),
                    token(a => a.fullName),
                    token(a => a.responsible),
                    token(a => a.level),
                ],
            }));

        // The four tree opt-ins at once (Signum's TreeClient.configure): hide the engine's own fields from
        // the generated view, make Find open the TREE instead of a search modal, autocomplete by name
        // through the tree's own endpoint, and order by fullName so a list view reads depth-first.
        // AFTER `cb.configure`, which is what creates the type's client TypeInfo.
        TreeClient.configure(getTypeInfo(DepartmentEntity));
    }
}
