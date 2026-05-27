import type { ObserveResult } from "../interfaces/observeResult.js";
import type { RepairPatch } from "../interfaces/repairPatch.js";
import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import { sanitizeObserveResult } from "./sanitizeObserveResult.js";
import { sanitizeRepairPatches } from "./sanitizeRepairPatches.js";
import { sanitizeHtmlCssResult } from "./sanitizeHtmlCssResult.js";

interface SanitizerContext {
  currentHtml?: string;
  previousHtml?: string;
}

export const sanitizers = {
  observe: (payload: ObserveResult) => 
    sanitizeObserveResult(payload),

  plan: (payload: RepairPatch[], context: SanitizerContext) =>
    sanitizeRepairPatches(payload, context),

  rewrite: (payload: HtmlCssResult, context: SanitizerContext) =>
    sanitizeHtmlCssResult(payload, {
      previousHtml: context.previousHtml ?? "",
    }),
};
