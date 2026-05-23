import type { ChatOpenAI } from "@langchain/openai";
import { planVisualRepair } from "../steps/planVisualRepair.js";
import { rewriteHtml } from "../steps/rewriteHtml.js";
import type { VisualRepairContext } from "./loop.js";

export type RepairActionType = "plan" | "rewrite";

export interface RepairAction {
  type: RepairActionType;
  reason: string;
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
      context.currentCss = rewriteResult.css;
      context.repairPatches = undefined;
      context.rewriteRounds += 1;

      return action;
    }
  }
}
