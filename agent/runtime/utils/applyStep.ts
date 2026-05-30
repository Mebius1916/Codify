import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { applyHtml } from "../../steps/applyHtml.js";
import type { VisualRepairContext } from "../loop.js";

export function runApplyStep(
  llm: BaseChatModel,
  context: VisualRepairContext,
  repairPlanGroupsJson: string,
) {
  return applyHtml(llm, {
    context,
    repairPlanGroupsJson,
    repairPlanGroups: context.repairPlanGroups,
    currentHtml: context.currentHtml,
  });
}
