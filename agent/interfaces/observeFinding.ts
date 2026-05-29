import { z } from "zod";

export const observeFindingSchema = z.object({
  category: z.string().min(1),
  target: z.string().min(1),
  evidence: z.string().min(1),
});

export const observeFindingListSchema = z.array(observeFindingSchema);

export type ObserveFinding = z.infer<typeof observeFindingSchema>;
