import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import { getDataIdRemovalState} from "./utils/dataIds.js";

export function sanitizeHtmlCssResult(
  result: HtmlCssResult,
  context: { previousHtml: string }
): HtmlCssResult {
  const nextHtml = result.html.trim();
  const nextCss = result.css.trim();
  const declaredRemovedDataIds = new Set(
    result.removedDataIds?.map((dataId) => dataId.trim()).filter(Boolean)
  );

  if (!nextHtml || !nextHtml.startsWith("<")) {
    throw new Error("rewrite 输出的 html 不是有效 HTML 片段");
  }

  const { invalidRemovedDataIds, missingDataIds, undeclaredMissingDataIds } =
    getDataIdRemovalState({
      previousHtml: context.previousHtml,
      nextHtml,
      declaredRemovedDataIds,
    });

  if (invalidRemovedDataIds.length > 0) {
    throw new Error(
      `rewrite 声明删除了不存在的 data-id: ${invalidRemovedDataIds.join(", ")}`
    );
  }

  if (undeclaredMissingDataIds.length > 0) {
    throw new Error(
      `rewrite 输出缺失未声明删除的原始 data-id: ${undeclaredMissingDataIds.join(", ")}`
    );
  }

  return {
    html: nextHtml,
    css: nextCss,
    removedDataIds: missingDataIds,
  };
}
