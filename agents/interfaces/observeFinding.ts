import { z } from "zod";

export const MAX_OBSERVE_GROUPS = 10;

export const observeGroupPrioritySchema = z.enum(["high", "medium", "low"]);

export const observeGroupSchema = z.object({
  priority: observeGroupPrioritySchema,
  dataIds: z.array(z.string().min(1)).min(2).max(12),
  observation: z.string().min(1), // baseline 目标观察
  acceptance: z.string().min(1), // 验收目标
});

export const observeOutputSchema = z.object({
  figmaDescription: z.string().min(1),
  groups: z.array(observeGroupSchema).max(MAX_OBSERVE_GROUPS),
});

export type ObserveGroup = z.infer<typeof observeGroupSchema>;
