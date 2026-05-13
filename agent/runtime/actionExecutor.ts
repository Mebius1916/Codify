import type { ChatOpenAI } from "@langchain/openai";
import { planVisualRepair } from "../steps/planVisualRepair.js";
import { rewriteHtml } from "../steps/rewriteHtml.js";
import type { VisualRepairContext } from "./loop.js";
import type { RepairAction } from "./repairAction.js";
import { refreshVisualRegression } from "./utils/visualRegression.js";
import { reportAgentProgress, runWithAgentProgress } from "./utils/progress.js";

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
  switch (action.type) {
    case "plan": {
      const { patches } = await planVisualRepair(llm, {
        context,
        currentHtml: context.currentHtml,
      });
      context.repairPatches = patches;
      context.observation = undefined;
      return action;
    }

    case "rewrite": {
      const repairPatchesJson = JSON.stringify(
        context.repairPatches ?? [],
        null,
        2
      );

      // patch 只作为结构化计划，真正的改写仍交给 AI 执行。
      const { result: rewriteResult } = await rewriteHtml(llm, {
        context,
        repairPatchesJson,
        currentHtml: context.currentHtml,
      });
      context.currentHtml = rewriteResult.html;
      context.repairPatches = undefined;
      context.rewriteRounds += 1;

      // 每轮 rewrite 后闭环视觉回归；新截图等会被下一步骤现场投影出去。
      try {
        await runWithAgentProgress(context, "visual-regression", {}, () =>
          refreshVisualRegression(context)
        );
        context.visualRegressionError = undefined;
      } catch (error) {
        // 渲染失败时不影响 rewrite 本身；固定工作流继续导出改写后的结果。
        context.visualRegressionError = formatRuntimeError(error);
        reportAgentProgress(context, "visual-regression:ignored-error", {
          error: context.visualRegressionError,
        });
      }

      return action;
    }
  }
}
