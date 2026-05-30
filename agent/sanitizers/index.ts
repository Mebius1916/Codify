import type { RepairPlanGroup } from "../interfaces/repairPatch.js";
import type { HtmlCssResult } from "../interfaces/htmlCssResult.js";
import { sanitizeRepairPlanGroups } from "./sanitizeRepairPatches.js";
import { sanitizeHtmlCssResult } from "./sanitizeHtmlCssResult.js";

interface SanitizerContext {
  currentHtml?: string;
  previousHtml?: string;
  repairPlanGroups?: RepairPlanGroup[];
}

export const sanitizers = {
  plan: (payload: { groups: RepairPlanGroup[] }, context: SanitizerContext) => ({
    groups: sanitizeRepairPlanGroups(payload.groups, context),
  }),

  rewrite: (payload: HtmlCssResult, context: SanitizerContext) =>
    sanitizeHtmlCssResult(payload, {
      previousHtml: context.previousHtml ?? "",
    }),
};
