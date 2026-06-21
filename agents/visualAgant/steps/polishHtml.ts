import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import {
  htmlCssResultSchema,
  type HtmlCssResult,
} from "../interfaces/htmlCssResult.js";
import { polishHtmlSystemPrompt } from "../prompts/polish.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { sanitizers } from "../sanitizers/index.js";

export interface PolishHtmlInput {
  context: VisualRepairContext;
  currentHtml: string;
  currentCss: string;
}

export interface PolishHtmlOutput {
  result: HtmlCssResult;
}

function buildPolishInstruction(
  figmaDescription: string,
  currentHtml: string,
  currentCss: string,
): string {
  return [
    polishHtmlSystemPrompt,
    "",
    "===== 本步任务 =====",
    "请在不改变视觉结果与语义内容的前提下优化代码结构，输出最终 html + css。",
    "",
    "## Figma 渲染图描述",
    figmaDescription || "(empty)",
    "",
    "## 当前 HTML",
    currentHtml,
    "",
    "## 当前 CSS",
    currentCss || "(empty)",
  ].join("\n");
}

export async function polishHtml(
  llm: BaseChatModel,
  input: PolishHtmlInput
): Promise<PolishHtmlOutput> {
  const structuredLlm = llm.withStructuredOutput(htmlCssResultSchema, {
    name: "HtmlCssResult",
    strict: true,
  });

  const instruction = new HumanMessage(
    buildPolishInstruction(
      input.context.observeFigmaDescription ?? "",
      input.currentHtml,
      input.currentCss,
    )
  );
  const rawResult = await structuredLlm.invoke([instruction], {
    signal: input.context.input.abortSignal,
  });
  const result = sanitizers.rewrite(htmlCssResultSchema.parse(rawResult), {
    previousHtml: input.currentHtml,
  });

  return { result };
}
