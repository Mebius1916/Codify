import { HumanMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";

import {
  htmlCssResultSchema,
  type HtmlCssResult,
} from "../interfaces/htmlCssResult.js";
import { rewriteHtmlSystemPrompt } from "../prompts/rewrite.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { compactHtmlForPrompt } from "../runtime/utils/htmlPrompt.js";
import { toLLMMessages } from "../runtime/utils/llmContext.js";
import { sanitizers } from "../sanitizers/index.js";

export interface RewriteHtmlInput {
  context: VisualRepairContext;
  repairPatchesJson: string;
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
    "请基于上文的视觉上下文（baseline/current/diff 三张图），",
    "按下面的结构化修复计划修改当前 Tailwind HTML 片段，并直接导出最终 html + css。",
    "",
    "## 结构化修复计划",
    repairPatchesJson,
    "",
    "## 当前 Tailwind HTML 片段",
    currentHtml,
  ].join("\n");
}

export async function rewriteHtml(
  llm: ChatOpenAI,
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

  // 固定工作流只投影当前视觉槽；修复计划和 HTML 由本步指令显式提供。
  const projected = toLLMMessages(input.context);
  const rawResult = await structuredLlm.invoke([...projected, instruction], {
    signal: input.context.input.abortSignal,
  });
  const result = sanitizers.rewrite(rawResult, {
    previousHtml: input.currentHtml,
  });

  return { result };
}
