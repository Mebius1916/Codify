import { HumanMessage } from "@langchain/core/messages";

import {
  observeResultSchema,
  type ObserveResult,
} from "../interfaces/observeResult.js";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  buildObserveVisualDiffUserText,
  observeVisualDiffSystemPrompt,
  type ObserveVisualDiffPromptInput,
} from "../prompts/observe.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { toLLMMessages } from "../runtime/utils/llmContext.js";
import { sanitizers } from "../sanitizers/index.js";

export interface ObserveVisualDiffInput extends ObserveVisualDiffPromptInput {
  context: VisualRepairContext;
}

export interface ObserveVisualDiffOutput {
  observation: ObserveResult;
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
  llm: BaseChatModel,
  input: ObserveVisualDiffInput
): Promise<ObserveVisualDiffOutput> {
  const structuredLlm = llm.withStructuredOutput(observeResultSchema, {
    name: "ObserveResult",
    strict: true,
  });

  const instruction = new HumanMessage(buildObserveInstruction(input));

  const projected = toLLMMessages(input.context);
  const observation = await structuredLlm.invoke([...projected, instruction], {
    signal: input.context.input.abortSignal,
  });
  const sanitized = sanitizers.observe(observeResultSchema.parse(observation));
  return { observation: sanitized };
}
