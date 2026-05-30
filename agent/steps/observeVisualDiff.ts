import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import {
  observeOutputSchema,
  type ObserveGroup,
} from "../interfaces/observeFinding.js";
import { observeVisualSystemPrompt } from "../prompts/observe.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { compactHtmlForPrompt } from "../runtime/utils/htmlPrompt.js";
import { toLLMMessages } from "../runtime/utils/llmContext.js";

export interface ObserveVisualDiffInput {
  context: VisualRepairContext;
  currentHtml: string;
}

export interface ObserveVisualDiffOutput {
  summary: string;
  figmaDescription: string;
  groups: ObserveGroup[];
}

function buildObserveInstruction(currentHtml: string): string {
  return [
    observeVisualSystemPrompt,
    "",
    "===== 本步任务 =====",
    "请基于三张视觉上下文图和下面的当前参考代码，只输出结构化 groups。",
    "",
    "## 当前参考代码",
    currentHtml,
  ].join("\n");
}

export async function observeVisualDiff(
  llm: BaseChatModel,
  input: ObserveVisualDiffInput
): Promise<ObserveVisualDiffOutput> {
  const structuredLlm = llm.withStructuredOutput(observeOutputSchema, {
    name: "ObserveOutput",
    strict: true,
  });

  const promptHtml = await compactHtmlForPrompt(input.currentHtml);
  const instruction = new HumanMessage(buildObserveInstruction(promptHtml));
  const projected = toLLMMessages(input.context, { includeVisualContext: true });

  const rawGroups = await structuredLlm.invoke([...projected, instruction], {
    signal: input.context.input.abortSignal,
  });

  const parsed = observeOutputSchema.parse(rawGroups);
  const summary = parsed.summary.trim();
  const figmaDescription = parsed.figmaDescription.trim();

  const groups = parsed.groups
    .map((group) => ({
      ...group,
      dataIds: group.dataIds.map((dataId) => dataId.trim()).filter(Boolean),
      observation: group.observation.trim(),
      acceptance: group.acceptance.trim(),
    }))
    .filter(
      (group) =>
        group.dataIds.length >= 1 &&
        group.observation &&
        group.acceptance,
    );

  return { summary, figmaDescription, groups };
}
