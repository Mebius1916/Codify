import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ObserveGroup } from "../interfaces/observeFinding.js";
import type { RepairPlanGroup } from "../interfaces/repairPatch.js";
import type { RunVisualRepairParams } from "../interfaces/runtime.js";
import { observeVisualDiff } from "../steps/observeVisualDiff.js";
import { planVisualRepair } from "../steps/planVisualRepair.js";
import { runWithAgentProgress } from "./utils/progress.js";
import { runApplyStep } from "./utils/applyStep.js";
import { runOptimizeStep } from "./utils/optimizeStep.js";

export interface VisualRepairContext {
  input: RunVisualRepairParams;
  currentHtml: string;
  currentCss: string;
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
  };

  const runWorkflow = async () => {
    const { figmaDescription, groups } = await runWithAgentProgress(
      context,
      "observe",
      () =>
        observeVisualDiff(llm, {
          context,
          currentHtml: context.currentHtml,
        }),
    );
    context.observeFigmaDescription = figmaDescription;
    context.observeGroups = groups;
    context.input.onObserve?.({ figmaDescription, groups });

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
      ({ result, patches }) => ({
        output: {
          patches: patches.map((patch) => ({
            id: patch.id,
            htmlLength: patch.html.length,
          })),
          mergedHtmlLength: result.html.length,
        },
      }),
    );
    context.currentHtml = applied.html;
    context.currentCss = "";

    return runWithAgentProgress(
      context,
      "optimize",
      () => runOptimizeStep(llm, context),
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
