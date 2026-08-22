import { SkillActivationEnum } from "@altea/altea-agent/data/SkillCustomization";
import type { SkillCode } from "@altea/altea-agent/server/SkillCode";
import { IntroductionSkill } from "@altea/altea-agent/server/Skills/IntroductionSkill";
import { AutocompleteSkill } from "@altea/altea-agent/server/Skills/AutocompleteSkill";
import { SearchSkill } from "@altea/altea-agent/server/Skills/SearchSkill";
import { RetrieveSkill } from "@altea/altea-agent/server/Skills/RetrieveSkill";
import { OperationSkill } from "@altea/altea-agent/server/Skills/OperationSkill";
import { CurrentServerContextSkill } from "@altea/altea-agent/server/Skills/CurrentServerContextSkill";
import { EntityUrlSkill } from "@altea/altea-agent/server/Skills/EntityUrlSkill";
import { GetUIContextSkill } from "@altea/altea-agent/server/Skills/GetUIContextSkill";
import { ConfirmUISkill } from "@altea/altea-agent/server/Skills/ConfirmUISkill";
import { ChartSkill } from "@altea/altea-agent/server/Skills/ChartSkill";

// eastwind's side of the agent module — Southwind keeps exactly this in Starter.cs: the chatbot's SKILL TREE
// and a second, all-lazy tree for the MCP endpoint.
//
// Two things that used to live here now belong to the module, because nothing about them is app-specific:
// the list of skill CLASSES (altea-agent registers the ten it ships — Signum's `SkillCode` base constructor
// auto-registers, so its apps never list them either) and `CurrentServerContextSkill.urlLeft`, which the
// starter assigns in one line exactly as Signum's Starter.cs does.
//
// The provider CREDENTIALS are not here either: they are the `chatbot` member of the ApplicationConfiguration
// row, which the starter hands to the module as `() => GlobalsLogic.configuration().chatbot` — Signum's
// `ChatbotLogic.Start(sb, () => Configuration.Value.Chatbot)`. With none set the module still starts: a model
// row can be created and the panels work, and only the first actual call to a provider fails, naming the
// missing key.
export namespace EastwindAgent {

    /** Southwind's chatbot tree: everything EAGER except charting, which the model unlocks with `Describe`. */
    export function chatbotSkill(): SkillCode {
        const search = new SearchSkill();
        // The queries worth spelling out in the prompt rather than making the model go looking (Southwind
        // names Order / Customer / Product / Employee / Category). eastwind's customer query is the
        // `CustomerRowModel` union over Person + Company — an unknown key here is silently skipped, so it
        // has to be the real one.
        search.inlineQueryName = new Set([
            "Order",
            "CustomerRowModel",
            "Product",
            "Employee",
            "Category",
            "Shipper",
        ]);

        return new IntroductionSkill()
            .withSubSkill(SkillActivationEnum.Eager, new AutocompleteSkill())
            .withSubSkill(SkillActivationEnum.Eager, search)
            .withSubSkill(SkillActivationEnum.Eager, new RetrieveSkill())
            .withSubSkill(SkillActivationEnum.Eager, new OperationSkill())
            .withSubSkill(SkillActivationEnum.Eager, new CurrentServerContextSkill())
            .withSubSkill(SkillActivationEnum.Eager, new EntityUrlSkill())
            .withSubSkill(SkillActivationEnum.Eager, new GetUIContextSkill())
            .withSubSkill(SkillActivationEnum.Eager, new ConfirmUISkill())
            .withSubSkill(SkillActivationEnum.Lazy, new ChartSkill());
    }

    /**
     * Southwind's MCP tree: the same skills, all LAZY, and without the two UI tools (an external MCP host
     * has no chat panel to answer them in — see AgentMcpServer, which filters them out anyway).
     */
    export function mcpSkill(): SkillCode {
        return new IntroductionSkill()
            .withSubSkill(SkillActivationEnum.Lazy, new AutocompleteSkill())
            .withSubSkill(SkillActivationEnum.Lazy, new SearchSkill())
            .withSubSkill(SkillActivationEnum.Lazy, new RetrieveSkill())
            .withSubSkill(SkillActivationEnum.Lazy, new OperationSkill())
            .withSubSkill(SkillActivationEnum.Lazy, new CurrentServerContextSkill())
            .withSubSkill(SkillActivationEnum.Lazy, new EntityUrlSkill())
            .withSubSkill(SkillActivationEnum.Lazy, new ChartSkill());
    }

}
