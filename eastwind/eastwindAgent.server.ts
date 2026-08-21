import { ChatbotConfigurationEmbedded } from "@altea/altea-agent/data/LanguageModel";
import { SkillActivationEnum } from "@altea/altea-agent/data/SkillCustomization";
import { SkillCodeLogic } from "@altea/altea-agent/server/SkillCodeLogic";
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

// eastwind's side of the agent module — Southwind keeps exactly this in Starter.cs: the CREDENTIALS, the
// chatbot's SKILL TREE, and a second, all-lazy tree for the MCP endpoint.
//
// The credentials come from the environment (`EASTWIND_AGENT_*`) rather than from a persisted
// ApplicationConfiguration, for the same reason eastwind's mail settings do — there is no such entity here.
// With none set the module still starts: a model row can be created and the panels work, and only the first
// actual call to a provider fails, naming the missing key.
export namespace EastwindAgent {

    let cached: ChatbotConfigurationEmbedded | undefined;

    export function configuration(): ChatbotConfigurationEmbedded {
        return cached ??= ChatbotConfigurationEmbedded.create({
            openAIAPIKey: process.env["EASTWIND_AGENT_OPENAI_KEY"] ?? null,
            anthropicAPIKey: process.env["EASTWIND_AGENT_ANTHROPIC_KEY"] ?? null,
            geminiAPIKey: process.env["EASTWIND_AGENT_GEMINI_KEY"] ?? null,
            mistralAPIKey: process.env["EASTWIND_AGENT_MISTRAL_KEY"] ?? null,
            githubModelsToken: process.env["EASTWIND_AGENT_GITHUB_TOKEN"] ?? null,
            deepSeekAPIKey: process.env["EASTWIND_AGENT_DEEPSEEK_KEY"] ?? null,
            ollamaUrl: process.env["EASTWIND_AGENT_OLLAMA_URL"] ?? null,
        });
    }

    /**
     * Register every skill CLASS the app uses (Southwind relies on Signum's auto-register scope; altea asks
     * for the classes explicitly — see SkillCodeLogic's header). Call BEFORE AgentLogic.start, because the
     * SkillCode table is seeded from this registry and `registerAgent` asserts against it.
     */
    export function registerSkills(): void {
        SkillCodeLogic.register(IntroductionSkill);
        SkillCodeLogic.register(AutocompleteSkill);
        SkillCodeLogic.register(SearchSkill);
        SkillCodeLogic.register(RetrieveSkill);
        SkillCodeLogic.register(OperationSkill);
        SkillCodeLogic.register(CurrentServerContextSkill);
        SkillCodeLogic.register(EntityUrlSkill);
        SkillCodeLogic.register(GetUIContextSkill);
        SkillCodeLogic.register(ConfirmUISkill);
        SkillCodeLogic.register(ChartSkill);
    }

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

    /** Signum's `CurrentServerContextSkill.UrlLeft = () => Configuration.Value.Email.UrlLeft`. */
    export function setUrlLeft(urlLeft: string): void {
        CurrentServerContextSkill.urlLeft = () => urlLeft;
        IntroductionSkill.applicationName = "eastwind";
    }
}
