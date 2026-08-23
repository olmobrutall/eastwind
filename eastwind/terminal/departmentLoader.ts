import "@altea/altea/server"; // installs save()/toLite()
import { table } from "@altea/altea/server/table";
import { TreeLogic } from "@altea/altea-tree/server/TreeLogic.server";
import { DepartmentEntity } from "../departments/Department.data";

// Seeds the tree demo. There is no Southwind counterpart (Southwind does not use Signum.Tree) and no
// Northwind table to read: a department hierarchy is the app's own demo data, so it is written out here.
//
// Each node goes through `TreeLogic.treeEntitySave` — the body of TreeOperation.Save — rather than a bare
// `save()`, because that is what computes `route` / `parentRoute` / `level` / `fullName` from
// `parentOrSibling`. Inserting a tree row without it would leave the route empty and the node invisible to
// every query the viewer runs. Depth-first, so each parent already has its route when its children are
// saved (`parentOrSibling` is a Lite, and the route arithmetic reads the parent's route from the database).
export namespace DepartmentLoader {

    /** name → children */
    const DEPARTMENTS: [string, string | null, string[]][] = [
        ["Eastwind Trading", "Nancy Davolio", []],
        ["Sales", "Andrew Fuller", ["Northern Europe", "Southern Europe", "North America", "Asia Pacific"]],
        ["Operations", "Janet Leverling", ["Warehouse", "Shipping", "Purchasing"]],
        ["Finance", "Margaret Peacock", ["Accounts payable", "Accounts receivable", "Controlling"]],
        ["Information Technology", "Steven Buchanan", ["Infrastructure", "Applications"]],
    ];

    export async function loadDepartments(): Promise<void> {
        if (await table(DepartmentEntity).count() > 0)
            return;

        // The root, then one child of the root per top-level area, then its own children.
        const [rootName, rootResponsible] = DEPARTMENTS[0]!;
        const root = await saveNode(rootName, rootResponsible, null);

        for (const [name, responsible, children] of DEPARTMENTS.slice(1)) {
            const area = await saveNode(name, responsible, root);

            for (const child of children)
                await saveNode(child, null, area);
        }
    }

    async function saveNode(name: string, responsible: string | null, parent: DepartmentEntity | null): Promise<DepartmentEntity> {
        const d = DepartmentEntity.create({
            name,
            responsible,
            parentOrSibling: parent?.toLite() ?? null,
        });

        await TreeLogic.treeEntitySave(DepartmentEntity, d);
        await d.save();
        return d;
    }
}
