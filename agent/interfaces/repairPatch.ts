import { z } from "zod";
import { observeGroupPrioritySchema } from "./observeFinding.js";

export const repairPlanChangeItemSchema = z.object({
  dataId: z.string().min(1),
  action: z.string().min(1),
});

export const repairPlanGroupSchema = z.object({
  priority: observeGroupPrioritySchema,
  dataIds: z.array(z.string().min(1)).min(2).max(12),
  change: z.array(repairPlanChangeItemSchema).min(1).max(12),
});

export const repairPlanGroupListSchema = z.object({
  groups: z.array(repairPlanGroupSchema).max(6),
});

export type RepairPlanGroup = z.infer<typeof repairPlanGroupSchema>;
