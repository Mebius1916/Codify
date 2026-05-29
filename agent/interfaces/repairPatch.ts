import { z } from "zod";

export const repairPatchTypeSchema = z.enum(["add", "remove", "update"]);
export const repairPatchPrioritySchema = z.enum(["high", "medium", "low"]);
const patchTargetPattern = /^data-id\s*=\s*(["']).+?\1$/;

export const repairPatchSchema = z.object({
  type: repairPatchTypeSchema,
  priority: repairPatchPrioritySchema,
  target: z.string().regex(patchTargetPattern, {
    message: 'target must use format data-id="..."',
  }),
  change: z.string().min(1),
});

export const repairPatchListSchema = z.array(repairPatchSchema);

export type RepairPatch = z.infer<typeof repairPatchSchema>;
