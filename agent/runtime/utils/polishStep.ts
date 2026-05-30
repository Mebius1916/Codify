import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { polishHtml } from "../../steps/polishHtml.js";
import type { VisualRepairContext } from "../loop.js";

export function runPolishStep(
  llm: BaseChatModel,
  context: VisualRepairContext,
) {
  return polishHtml(llm, {
    context,
    currentHtml: context.currentHtml,
    currentCss: context.currentCss,
  });
}
