import { type BaseMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";

import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import type { RepairPatch } from "../interfaces/repairPatch.js";
import type { ReviewResult } from "../interfaces/reviewResult.js";
import type { RunVisualRepairParams } from "../interfaces/runtime.js";
import { exportHtmlCss } from "../steps/exportHtmlCss.js";
import { observeVisualDiff } from "../steps/observeVisualDiff.js";
import { executeRepairAction } from "./actionExecutor.js";
import { decideNextAction, type RepairAction } from "./decideNextAction.js";
import { logAgentEvent } from "./utils/logger.js";

export interface VisualRepairContext {
  input: RunVisualRepairParams;
  round: number;
  rewriteRounds: number;
  currentHtml: string;
  currentPngBase64: string;
  diffPngBase64: string;
  diffRatio: number;
  repairPatches?: RepairPatch[];
  reviewResult?: ReviewResult;
  visualRegressionError?: string;
  lastAction?: RepairAction["type"];
  history: BaseMessage[];
}

const MAX_ACTION_ROUNDS = 10;

export async function runVisualRepairLoop(
  llm: ChatOpenAI,
  params: RunVisualRepairParams
): Promise<HtmlCssResult> {
  logAgentEvent("loop:start", {
    diffRatio: params.diffRatio,
    targetSimilarity: params.visualRegression.targetSimilarity,
  });

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

  // 基于当前上下文先决定第一次动作，后续每轮执行完再重新判断。
  let nextAction: RepairAction = decideNextAction(context);
  logAgentEvent("loop:next-action", {
    round: context.round,
    type: nextAction.type,
    reason: nextAction.reason,
  });

  while (context.round <= MAX_ACTION_ROUNDS) {
    if (nextAction.type === "finish") {
      logAgentEvent("loop:finish", {
        round: context.round,
        reason: nextAction.reason,
      });
      return exportHtmlCss(llm, { currentHtml: context.currentHtml });
    }

    // 执行动作会更新 context，例如补观察、重做计划、改 HTML、写入 review 结果。
    await executeRepairAction(llm, context, nextAction);

    // 一轮动作完成后，再根据最新上下文进入下一次决策。
    context.round += 1;
    nextAction = decideNextAction(context);
    logAgentEvent("loop:next-action", {
      round: context.round,
      type: nextAction.type,
      reason: nextAction.reason,
      diffRatio: context.diffRatio,
    });
  }

  // 超过最大轮次后停止自动修复，返回当前轮次产出的结果。
  logAgentEvent("loop:max-rounds-reached", { round: context.round });
  return exportHtmlCss(llm, { currentHtml: context.currentHtml });
}
