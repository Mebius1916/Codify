import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import { extractDataIds } from "./utils/dataIds.js";

export function sanitizeHtmlCssResult(
  result: HtmlCssResult,
  context: { previousHtml: string }
): HtmlCssResult {
  const nextHtml = result.html.trim();
  const nextCss = result.css.trim();

  if (!nextHtml || !nextHtml.startsWith("<")) {
    throw new Error("rewrite 输出的 html 不是有效 HTML 片段");
  }

  const previousDataIds = extractDataIds(context.previousHtml);
  const nextDataIds = extractDataIds(nextHtml);
  const keepsAllDataIds = [...previousDataIds].every((dataId) =>
    nextDataIds.has(dataId)
  );

  if (!keepsAllDataIds) {
    throw new Error("rewrite 输出缺失原始 HTML 中的 data-id");
  }

  return {
    html: nextHtml,
    css: nextCss,
  };
}
