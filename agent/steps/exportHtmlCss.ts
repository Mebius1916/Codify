import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";

import {
  htmlCssResultSchema,
  type HtmlCssResult,
} from "../interfaces/htmlCssResult.js";
import {
  buildExportHtmlCssUserText,
  exportHtmlCssSystemPrompt,
  type ExportHtmlCssPromptInput,
} from "../prompts/export.js";
import { logAgentError, logAgentEvent } from "../runtime/utils/logger.js";
import { sanitizeHtmlCssResult } from "../sanitizers/sanitizeHtmlCssResult.js";

const MAX_EXPORT_ATTEMPTS = 2;

function formatExportError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function exportHtmlCss(
  llm: ChatOpenAI,
  input: ExportHtmlCssPromptInput
): Promise<HtmlCssResult> {
  const structuredLlm = llm.withStructuredOutput(htmlCssResultSchema, {
    name: "HtmlCssResult",
    strict: true,
  });
  const system = new SystemMessage(exportHtmlCssSystemPrompt);
  const user = new HumanMessage({
    content: [
      {
        type: "text",
        text: buildExportHtmlCssUserText(input),
      },
    ],
  });

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_EXPORT_ATTEMPTS; attempt += 1) {
    logAgentEvent("export:llm:start", { attempt });
    const retryInstruction =
      attempt === 1
        ? []
        : [
            new HumanMessage(
              [
                "上一次输出没有通过结构化结果校验，请重新输出。",
                "失败原因：",
                formatExportError(lastError),
                "",
                "必须满足：",
                "- html 字段只放 HTML 片段，不能包含 style 标签",
                "- css 字段只放纯 CSS，不能包含 style 标签",
                "- 不要解释文字，不要 Markdown 包裹",
              ].join("\n")
            ),
          ];

    try {
      const result = await structuredLlm.invoke([
        system,
        user,
        ...retryInstruction,
      ]);
      const sanitized = sanitizeHtmlCssResult(result, {
        previousHtml: input.currentHtml,
      });
      logAgentEvent("export:llm:done", {
        attempt,
        htmlLength: sanitized.html.length,
        cssLength: sanitized.css.length,
      });
      return sanitized;
    } catch (error) {
      logAgentError("export:llm:failed", error);
      lastError = error;
    }
  }

  throw lastError;
}
