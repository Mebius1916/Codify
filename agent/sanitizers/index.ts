import type { ObserveResult } from "../interfaces/observeResult.js";
import type { RepairPatch } from "../interfaces/repairPatch.js";
import type { RewriteResult } from "../interfaces/rewriteResult.js";
import { sanitizeObserveResult } from "./sanitizeObserveResult.js";
import { sanitizeRepairPatches } from "./sanitizeRepairPatches.js";
import { sanitizeRewriteResult } from "./sanitizeRewriteResult.js";

interface SanitizerContext {
  currentHtml?: string;
  previousHtml?: string;
}

export const sanitizers = {
  observe: (payload: ObserveResult) => 
    sanitizeObserveResult(payload),

  plan: (payload: RepairPatch[], context: SanitizerContext) =>
    sanitizeRepairPatches(payload, context),

  rewrite: (payload: RewriteResult, context: SanitizerContext) =>
    sanitizeRewriteResult(payload, context),

};
