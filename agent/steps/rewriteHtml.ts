import { HumanMessage } from "@langchain/core/messages";

import {
  htmlCssResultSchema,
  type HtmlCssResult,
} from "../interfaces/htmlCssResult.js";
import type { RepairPatch } from "../interfaces/repairPatch.js";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { rewriteHtmlSystemPrompt } from "../prompts/rewrite.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { compactHtmlForPrompt } from "../runtime/utils/htmlPrompt.js";
import { toLLMMessages } from "../runtime/utils/llmContext.js";
import { sanitizers } from "../sanitizers/index.js";

export interface RewriteHtmlInput {
  context: VisualRepairContext;
  repairPatchesJson: string;
  repairPatches?: RepairPatch[];
  currentHtml: string;
}

export interface RewriteHtmlOutput {
  result: HtmlCssResult;
}

function buildRewriteInstruction(
  repairPatchesJson: string,
  currentHtml: string
): string {
  return [
    rewriteHtmlSystemPrompt,
    "",
    "===== 本步任务 =====",
    "请根据下面的结构化修复计划和参考代码，直接生成最终 html + css。",
    "",
    "## 结构化修复计划",
    repairPatchesJson,
    "",
    "## 参考代码",
    currentHtml,
  ].join("\n");
}

export async function rewriteHtml(
  llm: BaseChatModel,
  input: RewriteHtmlInput
): Promise<RewriteHtmlOutput> {
  const structuredLlm = llm.withStructuredOutput(htmlCssResultSchema, {
    name: "HtmlCssResult",
    strict: true,
  });

  const promptHtml = await compactHtmlForPrompt(input.currentHtml);
  const instruction = new HumanMessage(
    buildRewriteInstruction(input.repairPatchesJson, promptHtml)
  );
  const projected = toLLMMessages(input.context);

  const rawResult = await structuredLlm.invoke([...projected, instruction], {
    signal: input.context.input.abortSignal,
  });
  const result = sanitizers.rewrite(htmlCssResultSchema.parse(rawResult), {
    previousHtml: input.currentHtml,
    repairPatches: input.repairPatches,
  });

  return { result };
}
