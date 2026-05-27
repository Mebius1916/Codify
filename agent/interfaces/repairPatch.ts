import { z } from "zod";

export const repairPatchSchema = z.object({
  category: z.string().min(1),
  target: z.string().min(1),
  change: z.string().min(1),
  reason: z.string().min(1),
});

export const repairPatchListSchema = z.array(repairPatchSchema);

export type RepairPatch = z.infer<typeof repairPatchSchema>;
