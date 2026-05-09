import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";

import {
  observeResultSchema,
  type ObserveResult,
} from "../interfaces/observeResult.js";
import {
  buildObserveVisualDiffUserText,
  observeVisualDiffSystemPrompt,
  type ObserveVisualDiffPromptInput,
} from "../prompts/observe.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { toLLMMessages } from "../runtime/utils/llmContext.js";
import { logAgentEvent } from "../runtime/utils/logger.js";
import { sanitizers } from "../sanitizers/index.js";

export interface ObserveVisualDiffInput extends ObserveVisualDiffPromptInput {
  context: VisualRepairContext;
}

export interface ObserveVisualDiffOutput {
  observation: ObserveResult;
  appendedMessages: BaseMessage[];
}

function buildObserveInstruction(input: ObserveVisualDiffPromptInput): string {
  return [
    observeVisualDiffSystemPrompt,
    "",
    "===== 本步任务 =====",
    buildObserveVisualDiffUserText(input),
  ].join("\n");
}

export async function observeVisualDiff(
  llm: ChatOpenAI,
  input: ObserveVisualDiffInput
): Promise<ObserveVisualDiffOutput> {
  const structuredLlm = llm.withStructuredOutput(observeResultSchema, {
    name: "ObserveResult",
    strict: true,
  });

  const instruction = new HumanMessage(buildObserveInstruction(input));

  logAgentEvent("observe:project-messages:start", { round: input.context.round });
  const projected = await toLLMMessages(input.context, llm);
  logAgentEvent("observe:llm:start", {
    round: input.context.round,
    messages: projected.length + 1,
    diffRatio: input.diffRatio,
  });
  const observation = await structuredLlm.invoke([...projected, instruction]);
  const sanitized = sanitizers.observe(observation);
  logAgentEvent("observe:llm:done", {
    round: input.context.round,
    summary: sanitized.summary,
  });

  // 把本步的 Human 指令 + AI 的结构化观察结果 append 回去，作为后续步骤可见的"历史"。
  // AI 这一侧用 JSON.stringify 把结构化结果落为文本，便于下游 step 的 LLM 直接读。
  const appendedMessages: BaseMessage[] = [
    instruction,
    new AIMessage(JSON.stringify(sanitized, null, 2)),
  ];

  return { observation: sanitized, appendedMessages };
}
