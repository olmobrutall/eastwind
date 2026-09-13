import "@altea/altea/server";
import "@altea/altea/server/dynamicQuery/fluentIncludeQuery";
import { SchemaBuilder } from "@altea/altea/server/schema";
import { TreeLogic } from "@altea/altea-tree/server/TreeLogic";
import { DepartmentEntity } from "./Department.data";

// The app half of the tree demo: one include, and `withTree` supplies the four query expressions
// (Children / Parent / Descendants / Ascendants) and all seven operations.
//
// `copy` is what makes TreeOperation.Copy exist — the module cannot know how to duplicate a row of a type
// it has never seen, so a tree type that wants Copy says so here (Signum's same optional argument).
export namespace DepartmentsLogic {
    export function start(sb: SchemaBuilder): void {
        TreeLogic.withTree(sb.include(DepartmentEntity), {
            copy: d => {
                const clone = new DepartmentEntity();
                clone.name = d.name;
                clone.responsible = d.responsible;
                return clone;
            },
        }).withQuery();
    }
}
