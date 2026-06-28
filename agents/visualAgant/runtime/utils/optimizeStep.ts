import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { optimizeHtml } from "../../steps/optimizeHtml.js";
import type { VisualRepairContext } from "../loop.js";

export function runOptimizeStep(
  llm: BaseChatModel,
  context: VisualRepairContext,
) {
  return optimizeHtml(llm, {
    context,
    currentHtml: context.currentHtml,
    currentCss: context.currentCss,
  });
}
