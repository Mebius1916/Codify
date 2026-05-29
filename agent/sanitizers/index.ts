import type { RepairPatch } from "../interfaces/repairPatch.js";
import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import { sanitizeRepairPatches } from "./sanitizeRepairPatches.js";
import { sanitizeHtmlCssResult } from "./sanitizeHtmlCssResult.js";

interface SanitizerContext {
  currentHtml?: string;
  previousHtml?: string;
  repairPatches?: RepairPatch[];
}

export const sanitizers = {
  plan: (payload: RepairPatch[], context: SanitizerContext) =>
    sanitizeRepairPatches(payload, context),

  rewrite: (payload: HtmlCssResult, context: SanitizerContext) =>
    sanitizeHtmlCssResult(payload, {
      previousHtml: context.previousHtml ?? "",
      repairPatches: context.repairPatches,
    }),
};
