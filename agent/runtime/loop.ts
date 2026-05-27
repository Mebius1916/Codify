import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ObserveResult } from "../interfaces/observeResult.js";
import type { RepairPatch } from "../interfaces/repairPatch.js";
import type { RunVisualRepairParams } from "../interfaces/runtime.js";
import { observeVisualDiff } from "../steps/observeVisualDiff.js";
import { planVisualRepair } from "../steps/planVisualRepair.js";
import { rewriteHtml } from "../steps/rewriteHtml.js";
import { runWithAgentProgress } from "./utils/progress.js";

export interface VisualRepairContext {
  input: RunVisualRepairParams;
  round: number;
  rewriteRounds: number;
  currentHtml: string;
  currentCss: string;
  currentPngBase64: string;
  diffPngBase64: string;
  diffRatio: number;
  observation?: ObserveResult;
  repairPatches?: RepairPatch[];
}

export async function runVisualRepairLoop(
  llm: BaseChatModel,
  params: RunVisualRepairParams,
): Promise<HtmlCssResult> {
  // 维护固定工作流里的结构化 handoff state；messages 由当前步骤现场投影。
  const context: VisualRepairContext = {
    input: params,
    round: 1,
    rewriteRounds: 0,
    currentHtml: params.html,
    currentCss: "",
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
    ({ observation }) => ({ output: observation }),
  );

  context.observation = observation;

  const planReason = "固定工作流：观察后生成一轮修复计划。";
  const { patches } = await runWithAgentProgress(
    context,
    "plan",
    { reason: planReason },
    () =>
      planVisualRepair(llm, {
        context,
        currentHtml: context.currentHtml,
      }),
    ({ patches }) => ({ output: { patches } }),
  );
  context.repairPatches = patches;
  context.observation = undefined;

  const repairPatchesJson = JSON.stringify(context.repairPatches ?? [], null, 2);

  // patch 只作为结构化计划，真正的改写仍交给 AI 执行。
  const rewriteReason = "固定工作流：按修复计划执行一次改写并产出最终 html + css。";
  const { result } = await runWithAgentProgress(
    context,
    "rewrite",
    { reason: rewriteReason },
    () =>
      rewriteHtml(llm, {
        context,
        repairPatchesJson,
        currentHtml: context.currentHtml,
      }),
    ({ result }) => ({ output: result }),
  );
  context.currentHtml = result.html;
  context.currentCss = result.css;
  context.repairPatches = undefined;
  context.rewriteRounds += 1;

  return { html: context.currentHtml, css: context.currentCss };
}
