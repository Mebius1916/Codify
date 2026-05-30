import { z } from "zod";

export const observeGroupPrioritySchema = z.enum(["high", "medium", "low"]);

export const observeGroupSchema = z.object({
  priority: observeGroupPrioritySchema,
  dataIds: z.array(z.string().min(1)).min(2).max(12),
  observation: z.string().min(1), // 观察结果
  acceptance: z.string().min(1), // 修复目标
});

export const observeOutputSchema = z.object({
  summary: z.string().min(1),
  figmaDescription: z.string().min(1),
  groups: z.array(observeGroupSchema).max(6),
});

export type ObserveGroup = z.infer<typeof observeGroupSchema>;
