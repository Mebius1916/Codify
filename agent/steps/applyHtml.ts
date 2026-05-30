import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import {
  htmlFragmentResultSchema,
  type HtmlFragmentResult,
} from "../interfaces/htmlFragmentResult.js";
import type { RepairPlanGroup } from "../interfaces/repairPatch.js";
import { applyHtmlSystemPrompt } from "../prompts/apply.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { compactHtmlForPrompt } from "../runtime/utils/htmlPrompt.js";
import { toLLMMessages } from "../runtime/utils/llmContext.js";

export interface ApplyHtmlInput {
  context: VisualRepairContext;
  repairPlanGroupsJson: string;
  repairPlanGroups?: { groups: RepairPlanGroup[] };
  currentHtml: string;
}

export interface ApplyHtmlOutput {
  result: HtmlFragmentResult;
}

function buildApplyInstruction(
  figmaDescription: string,
  repairPlanGroupsJson: string,
  currentHtml: string,
): string {
  return [
    applyHtmlSystemPrompt,
    "",
    "===== 本步任务 =====",
    "请根据结构化修复计划，先完成补丁执行，只输出 Tailwind HTML 片段。",
    "",
    "## Figma 渲染图描述",
    figmaDescription || "(empty)",
    "",
    "## 结构化修复计划",
    repairPlanGroupsJson,
    "",
    "## 参考代码",
    currentHtml,
  ].join("\n");
}

export async function applyHtml(
  llm: BaseChatModel,
  input: ApplyHtmlInput
): Promise<ApplyHtmlOutput> {
  const structuredLlm = llm.withStructuredOutput(htmlFragmentResultSchema, {
    name: "HtmlFragmentResult",
    strict: true,
  });

  const promptHtml = await compactHtmlForPrompt(input.currentHtml);
  const instruction = new HumanMessage(
    buildApplyInstruction(
      input.context.observeFigmaDescription ?? "",
      input.repairPlanGroupsJson,
      promptHtml,
    )
  );
  const projected = toLLMMessages(input.context);

  const rawResult = await structuredLlm.invoke([...projected, instruction], {
    signal: input.context.input.abortSignal,
  });
  const parsed = htmlFragmentResultSchema.parse(rawResult);
  const nextHtml = parsed.html.trim();
  if (!nextHtml || !nextHtml.startsWith("<")) {
    throw new Error("apply 输出的 html 不是有效 HTML 片段");
  }

  return { result: { html: nextHtml } };
}
