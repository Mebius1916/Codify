import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import type { HtmlFragmentResult } from "../interfaces/htmlFragmentResult.js";
import type { RepairPlanGroup } from "../interfaces/repairPatch.js";
import {
  scopedHtmlPatchResultSchema,
  type ScopedHtmlPatch,
} from "../interfaces/scopedHtmlPatch.js";
import { applyHtmlSystemPrompt } from "../prompts/apply.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { compactHtmlForPrompt } from "../runtime/utils/htmlPrompt.js";
import { applyScopedHtmlPatches } from "./utils/scopedPatch.js";

export interface ApplyHtmlInput {
  context: VisualRepairContext;
  repairPlanGroupsJson: string;
  repairPlanGroups?: { groups: RepairPlanGroup[] };
  currentHtml: string;
}

export interface ApplyHtmlOutput {
  result: HtmlFragmentResult;
  patches: ScopedHtmlPatch[];
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
    "请根据结构化修复计划，输出局部 HTML patches。程序会根据 id 完成替换。",
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
  const structuredLlm = llm.withStructuredOutput(scopedHtmlPatchResultSchema, {
    name: "ScopedHtmlPatchResult",
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
  const rawResult = await structuredLlm.invoke([instruction], {
    signal: input.context.input.abortSignal,
  });
  const parsed = scopedHtmlPatchResultSchema.parse(rawResult);
  const nextHtml = applyScopedHtmlPatches(input.currentHtml, parsed.patches).trim();
  if (!nextHtml || !nextHtml.startsWith("<")) {
    throw new Error("apply patch 后的 html 不是有效 HTML 片段");
  }

  return { result: { html: nextHtml }, patches: parsed.patches };
}
