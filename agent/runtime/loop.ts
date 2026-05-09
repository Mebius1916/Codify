import { type BaseMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";

import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import type { RepairPatch } from "../interfaces/repairPatch.js";
import type { RunVisualRepairParams } from "../interfaces/runtime.js";
import { exportHtmlCss } from "../steps/exportHtmlCss.js";
import { observeVisualDiff } from "../steps/observeVisualDiff.js";
import { executeRepairAction } from "./actionExecutor.js";
import type { RepairAction } from "./repairAction.js";

export interface VisualRepairContext {
  input: RunVisualRepairParams;
  round: number;
  rewriteRounds: number;
  currentHtml: string;
  currentPngBase64: string;
  diffPngBase64: string;
  diffRatio: number;
  repairPatches?: RepairPatch[];
  visualRegressionError?: string;
  history: BaseMessage[];
}

export async function runVisualRepairLoop(
  llm: ChatOpenAI,
  params: RunVisualRepairParams
): Promise<HtmlCssResult> {
  // 维护本轮修复过程中逐步产出的中间结果；事实源唯一，messages 由 toLLMMessages 派生。
  const context: VisualRepairContext = {
    input: params,
    round: 1,
    rewriteRounds: 0,
    currentHtml: params.html,
    currentPngBase64: params.currentPngBase64,
    diffPngBase64: params.diffPngBase64,
    diffRatio: params.diffRatio,
    history: [],
  };

  const { appendedMessages: observeAppend } = await observeVisualDiff(llm, {
    context,
    diffRatio: params.diffRatio,
  });

  context.history.push(...observeAppend);

  const planAction: RepairAction = {
    type: "plan",
    reason: "固定工作流：观察后生成一轮修复计划。",
  };
  await executeRepairAction(llm, context, planAction);

  context.round += 1;
  const rewriteAction: RepairAction = {
    type: "rewrite",
    reason: "固定工作流：按修复计划执行一次改写并刷新视觉回归结果。",
  };
  await executeRepairAction(llm, context, rewriteAction);

  return exportHtmlCss(llm, { currentHtml: context.currentHtml });
}
