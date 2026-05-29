import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import {
  observeFindingListSchema,
  type ObserveFinding,
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
  findings: ObserveFinding[];
}

function buildObserveInstruction(currentHtml: string): string {
  return [
    observeVisualSystemPrompt,
    "",
    "===== 本步任务 =====",
    "请基于三张视觉上下文图和下面的当前参考代码，只输出结构化 findings。",
    "",
    "## 当前参考代码",
    currentHtml,
  ].join("\n");
}

export async function observeVisualDiff(
  llm: BaseChatModel,
  input: ObserveVisualDiffInput
): Promise<ObserveVisualDiffOutput> {
  const structuredLlm = llm.withStructuredOutput(observeFindingListSchema, {
    name: "ObserveFindingList",
    strict: true,
  });

  const promptHtml = await compactHtmlForPrompt(input.currentHtml);
  const instruction = new HumanMessage(buildObserveInstruction(promptHtml));
  const projected = toLLMMessages(input.context);

  const rawFindings = await structuredLlm.invoke([...projected, instruction], {
    signal: input.context.input.abortSignal,
  });

  const findings = observeFindingListSchema.parse(rawFindings).map((finding) => ({
    ...finding,
    category: finding.category.trim(),
    target: finding.target.trim(),
    evidence: finding.evidence.trim(),
  })).filter((finding) => finding.category && finding.target && finding.evidence);

  return { findings };
}
