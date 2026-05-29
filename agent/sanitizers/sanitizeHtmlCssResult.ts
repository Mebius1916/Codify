import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import type { RepairPatch } from "../interfaces/repairPatch.js";
import { getDataIdRemovalState } from "./utils/dataIds.js";

export function sanitizeHtmlCssResult(
  result: HtmlCssResult,
  context: { previousHtml: string; repairPatches?: RepairPatch[] }
): HtmlCssResult {
  const nextHtml = result.html.trim();
  const nextCss = result.css.trim();

  if (!nextHtml || !nextHtml.startsWith("<")) {
    throw new Error("rewrite 输出的 html 不是有效 HTML 片段");
  }

  const declaredRemovedDataIds = extractDeclaredRemovedDataIds(
    context.repairPatches ?? []
  );
  const { undeclaredMissingDataIds } = getDataIdRemovalState({
    previousHtml: context.previousHtml,
    nextHtml,
    declaredRemovedDataIds,
  });
  if (undeclaredMissingDataIds.length > 0) {
    throw new Error(
      `rewrite 丢失了未声明可删除的 data-id: ${undeclaredMissingDataIds.join(", ")}`
    );
  }

  return {
    html: nextHtml,
    css: nextCss,
  };
}

function extractDeclaredRemovedDataIds(patches: RepairPatch[]): Set<string> {
  const removedDataIds = new Set<string>();
  const dataIdInTargetPattern = /\bdata-id\s*=\s*(["'])(.*?)\1/i;

  for (const patch of patches) {
    if (patch.type !== "remove") continue;
    const match = patch.target.match(dataIdInTargetPattern);
    const dataId = match?.[2]?.trim();
    if (!dataId) continue;
    removedDataIds.add(dataId);
  }

  return removedDataIds;
}
