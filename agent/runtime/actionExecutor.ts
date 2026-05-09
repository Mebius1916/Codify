import type { ChatOpenAI } from "@langchain/openai";
import { planVisualRepair } from "../steps/planVisualRepair.js";
import { reviewHtml } from "../steps/reviewHtml.js";
import { rewriteHtml } from "../steps/rewriteHtml.js";
import type { RepairAction } from "./decideNextAction.js";
import type { VisualRepairContext } from "./loop.js";
import { resolveExecutableAction } from "./utils/actionHelpers.js";
import { logAgentError, logAgentEvent } from "./utils/logger.js";
import { refreshVisualRegression } from "./utils/visualRegression.js";

function formatRuntimeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function executeRepairAction(
  llm: ChatOpenAI,
  context: VisualRepairContext,
  action: RepairAction
): Promise<RepairAction> {
  const executableAction = resolveExecutableAction(context, action);
  logAgentEvent("action:start", {
    round: context.round,
    requested: action.type,
    executable: executableAction.type,
  });

  switch (executableAction.type) {
    case "plan": {
      context.lastAction = "plan";
      const { patches, appendedMessages } = await planVisualRepair(llm, {
        context,
        currentHtml: context.currentHtml,
      });
      context.history.push(...appendedMessages);
      context.repairPatches = patches;
      // 清掉旧 review
      context.reviewResult = undefined;
      logAgentEvent("action:done", {
        round: context.round,
        type: executableAction.type,
        patches: patches.length,
      });
      return executableAction;
    }

    case "rewrite": {
      context.lastAction = "rewrite";
      context.rewriteRounds += 1;
      const repairPatchesJson = JSON.stringify(
        context.repairPatches ?? [],
        null,
        2
      );

      // patch 只作为结构化计划，真正的改写仍交给 AI 执行。
      const { result: rewriteResult, appendedMessages: rewriteAppend } =
        await rewriteHtml(llm, {
          context,
          repairPatchesJson,
          currentHtml: context.currentHtml,
        });
      context.history.push(...rewriteAppend);
      context.currentHtml = rewriteResult.html;

      // 每轮 rewrite 后闭环视觉回归；新截图等会被 toLLMMessages 在下一次调用时自然投影出去。
      try {
        logAgentEvent("visual-regression:start", { round: context.round });
        await refreshVisualRegression(context);
        context.visualRegressionError = undefined;
        logAgentEvent("visual-regression:done", {
          round: context.round,
          diffRatio: context.diffRatio,
          similarity: 1 - context.diffRatio,
        });
      } catch (error) {
        // 渲染失败时不影响 rewrite 本身；下一轮仍可基于代码层 review 继续推进。
        context.visualRegressionError = formatRuntimeError(error);
        logAgentError("visual-regression:failed", error);
      }

      // 对改写结果做代码层 + 视觉层综合自检，为下一步动作选择提供依据。
      const { result, appendedMessages } = await reviewHtml(llm, {
        context,
        repairPatchesJson,
        currentHtml: context.currentHtml,
      });
      context.history.push(...appendedMessages);
      context.reviewResult = result;
      logAgentEvent("action:done", {
        round: context.round,
        type: executableAction.type,
        reviewStatus: result.status,
      });
      return executableAction;
    }

    case "finish":
      context.lastAction = "finish";
      logAgentEvent("action:done", {
        round: context.round,
        type: executableAction.type,
      });
      return executableAction;
  }
}
