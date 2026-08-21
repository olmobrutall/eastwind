import { init } from "@altea/altea/data/reflection";
import { AgentSymbol } from "@altea/altea-agent/data/SkillCustomization";

// Port of Southwind's `SouthwindAgentUseCases` (Globals/ApplicationConfigurationEntity.cs) — the app's own
// agents, beyond the three @altea/altea-agent declares itself (Chatbot / QuestionSummarizer /
// ConversationSumarizer). In the DATA layer because a symbol has to be reachable from both tiers.
export namespace EastwindAgentUseCases {
    /** The tree exposed at /api/mcp — all sub-skills Lazy, so an external host discovers them one by one. */
    export const MCP: AgentSymbol = init();
}
