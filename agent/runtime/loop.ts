import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ObserveFinding } from "../interfaces/observeFinding.js";
import type { RepairPatch } from "../interfaces/repairPatch.js";
import type { RunVisualRepairParams } from "../interfaces/runtime.js";
import { observeVisualDiff } from "../steps/observeVisualDiff.js";
import { planVisualRepair } from "../steps/planVisualRepair.js";
import { runWithAgentProgress } from "./utils/progress.js";
import { runRewriteStep } from "./utils/rewriteStep.js";

export interface VisualRepairContext {
  input: RunVisualRepairParams;
  round: number;
  rewriteRounds: number;
  currentHtml: string;
  currentCss: string;
  currentPngBase64: string;
  diffPngBase64: string;
  diffRatio: number;
  observeFindings?: ObserveFinding[];
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

  const { findings } = await runWithAgentProgress(
    context,
    "observe",
    () =>
      observeVisualDiff(llm, {
        context,
        currentHtml: context.currentHtml,
      }),
    ({ findings }) => ({ output: { findings } }),
  );
  context.observeFindings = findings;

  const { patches } = await runWithAgentProgress(
    context,
    "plan",
    () =>
      planVisualRepair(llm, {
        context,
        currentHtml: context.currentHtml,
        findings: context.observeFindings ?? [],
      }),
    ({ patches }) => ({ output: { patches } }),
  );
  context.observeFindings = undefined;
  context.repairPatches = patches;

  const repairPatchesJson = JSON.stringify(context.repairPatches ?? [], null, 2);

  // patch 只作为结构化计划，真正的改写仍交给 AI 执行。
  const { result } = await runWithAgentProgress(
    context,
    "rewrite",
    () => runRewriteStep(llm, context, repairPatchesJson, params.rewriteTimeoutMs),
    ({ result }) => ({ output: result }),
  );
  context.currentHtml = result.html;
  context.currentCss = result.css;
  context.repairPatches = undefined;
  context.rewriteRounds += 1;

  return { html: context.currentHtml, css: context.currentCss };
}
