import { init } from "@altea/altea/data/reflection";
import {
    WorkflowActionSymbol, WorkflowConditionSymbol, WorkflowLaneActorsSymbol,
} from "@altea/altea-workflow/data/WorkflowEval";

// The app's workflow hooks, as SYMBOLS.
//
// This file exists only because of altea's Eval divergence (see @altea/altea-workflow's data/WorkflowEval.ts):
// Signum stores each condition / action / lane-actor evaluator as C# SOURCE in the row a designer types into,
// and compiles it with Roslyn at runtime. altea has no Signum.Eval, so every hook is a code-declared symbol
// the designer PICKS from a dropdown, with the implementation registered server-side
// (./eastwindWorkflow.server.ts).
//
// It is a DATA-layer module because the symbols cross both tiers: the server registers behaviour against them
// and the client's pickers list them.

export namespace EastwindWorkflowSymbols {

    // ---- Conditions -----------------------------------------------------------------------------------
    /** The order's total is over 1000 — the "needs approval" branch of a demo workflow. */
    export const OrderIsLarge: WorkflowConditionSymbol = init({ niceName: "Order is large (over 1000)" });
    /** The order has actually shipped, so a "wait for shipment" gateway may continue. */
    export const OrderIsShipped: WorkflowConditionSymbol = init({ niceName: "Order is shipped" });

    // ---- Actions --------------------------------------------------------------------------------------
    export const ShipOrder: WorkflowActionSymbol = init({ niceName: "Ship the order" });
    export const CancelOrder: WorkflowActionSymbol = init({ niceName: "Cancel the order" });

    // ---- Lane actors ----------------------------------------------------------------------------------
    /** Notify the order's own employee — a per-case audience a static actor list cannot express. */
    export const OrderEmployee: WorkflowLaneActorsSymbol = init({ niceName: "The order's employee" });
    /** Notify every user in the Administrators role. */
    export const AllAdministrators: WorkflowLaneActorsSymbol = init({ niceName: "All administrators" });
}
