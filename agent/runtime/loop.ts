import type { ChatOpenAI } from "@langchain/openai";

import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import type { ObserveResult } from "../interfaces/observeResult.js";
import type { RepairPatch } from "../interfaces/repairPatch.js";
import type { RunVisualRepairParams } from "../interfaces/runtime.js";
import { exportHtmlCss } from "../steps/exportHtmlCss.js";
import { observeVisualDiff } from "../steps/observeVisualDiff.js";
import { executeRepairAction } from "./actionExecutor.js";
import type { RepairAction } from "./repairAction.js";
import { runWithAgentProgress } from "./utils/progress.js";

export interface VisualRepairContext {
  input: RunVisualRepairParams;
  round: number;
  rewriteRounds: number;
  currentHtml: string;
  currentPngBase64: string;
  diffPngBase64: string;
  diffRatio: number;
  observation?: ObserveResult;
  repairPatches?: RepairPatch[];
  visualRegressionError?: string;
}

export async function runVisualRepairLoop(
  llm: ChatOpenAI,
  params: RunVisualRepairParams
): Promise<HtmlCssResult> {
  // 维护固定工作流里的结构化 handoff state；messages 由当前步骤现场投影。
  const context: VisualRepairContext = {
    input: params,
    round: 1,
    rewriteRounds: 0,
    currentHtml: params.html,
    currentPngBase64: params.currentPngBase64,
    diffPngBase64: params.diffPngBase64,
    diffRatio: params.diffRatio,
  };

  const { observation } = await runWithAgentProgress(
    context,
    "observe",
    { diffRatio: params.diffRatio },
    () =>
      observeVisualDiff(llm, {
        context,
        diffRatio: params.diffRatio,
      }),
    ({ observation }) => ({ output: observation })
  );

  context.observation = observation;

  const planAction: RepairAction = {
    type: "plan",
    reason: "固定工作流：观察后生成一轮修复计划。",
  };
  await runWithAgentProgress(context, "plan", { reason: planAction.reason }, () =>
    executeRepairAction(llm, context, planAction),
    () => ({ output: { patches: context.repairPatches ?? [] } })
  );

  context.round += 1;
  const rewriteAction: RepairAction = {
    type: "rewrite",
    reason: "固定工作流：按修复计划执行一次改写并刷新视觉回归结果。",
  };
  await runWithAgentProgress(context, "rewrite", { reason: rewriteAction.reason }, () =>
    executeRepairAction(llm, context, rewriteAction),
    () => ({ output: { html: context.currentHtml } })
  );

  return runWithAgentProgress(context, "export", {}, () =>
    exportHtmlCss(llm, {
      currentHtml: context.currentHtml,
      abortSignal: context.input.abortSignal,
    }),
    (result) => ({ output: result })
  );
}
