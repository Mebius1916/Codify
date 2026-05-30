import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";

export function sanitizeHtmlCssResult(
  result: HtmlCssResult,
  _context: { previousHtml: string }
): HtmlCssResult {
  const nextHtml = result.html.trim();
  const nextCss = result.css.trim();

  if (!nextHtml || !nextHtml.startsWith("<")) {
    throw new Error("rewrite 输出的 html 不是有效 HTML 片段");
  }

  return {
    html: nextHtml,
    css: nextCss,
  };
}
