import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ObserveGroup } from "../interfaces/observeFinding.js";
import type { RepairPlanGroup } from "../interfaces/repairPatch.js";
import type { RunVisualRepairParams } from "../interfaces/runtime.js";
import { observeVisualDiff } from "../steps/observeVisualDiff.js";
import { planVisualRepair } from "../steps/planVisualRepair.js";
import { runWithAgentProgress } from "./utils/progress.js";
import { runApplyStep } from "./utils/applyStep.js";
import { runPolishStep } from "./utils/polishStep.js";

export interface VisualRepairContext {
  input: RunVisualRepairParams;
  currentHtml: string;
  currentCss: string;
  currentPngBase64: string;
  diffPngBase64: string;
  diffRatio: number;
  observeSummary?: string;
  observeFigmaDescription?: string;
  observeGroups?: ObserveGroup[];
  repairPlanGroups?: { groups: RepairPlanGroup[] };
}

export async function runVisualRepairLoop(
  llm: BaseChatModel,
  params: RunVisualRepairParams,
): Promise<HtmlCssResult> {
  // 维护固定工作流里的结构化 handoff state；messages 由当前步骤现场投影。
  const context: VisualRepairContext = {
    input: params,
    currentHtml: params.html,
    currentCss: "",
    currentPngBase64: params.currentPngBase64,
    diffPngBase64: params.diffPngBase64,
    diffRatio: params.diffRatio,
  };

  const runWorkflow = async () => {
    const { summary, figmaDescription, groups } = await runWithAgentProgress(
      context,
      "observe",
      () =>
        observeVisualDiff(llm, {
          context,
          currentHtml: context.currentHtml,
        }),
    );
    context.observeSummary = summary;
    context.observeFigmaDescription = figmaDescription;
    context.observeGroups = groups;

    const { planGroups } = await runWithAgentProgress(
      context,
      "plan",
      () =>
        planVisualRepair(llm, {
          context,
          currentHtml: context.currentHtml,
          groups: context.observeGroups ?? [],
        }),
    );
    context.observeSummary = undefined;
    context.observeFigmaDescription = undefined;
    context.observeGroups = undefined;
    context.repairPlanGroups = planGroups;

    const repairPlanGroupsJson = JSON.stringify(
      context.repairPlanGroups ?? { groups: [] },
      null,
      2,
    );

    const { result: applied } = await runWithAgentProgress(
      context,
      "apply",
      () => runApplyStep(llm, context, repairPlanGroupsJson),
    );
    context.currentHtml = applied.html;
    context.currentCss = "";

    return runWithAgentProgress(
      context,
      "polish",
      () => runPolishStep(llm, context),
    );
  };

  const abortController = new AbortController();
  const mergedSignal = context.input.abortSignal
    ? AbortSignal.any([context.input.abortSignal, abortController.signal])
    : abortController.signal;
    
  context.input.abortSignal = mergedSignal;

  const { result } = await runWorkflow();
  context.currentHtml = result.html;
  context.currentCss = result.css;
  context.repairPlanGroups = undefined;

  return { html: context.currentHtml, css: context.currentCss };
}
