import { z } from "zod";

const styleTagPattern = /<\/?style(?:\s|>|\/)/i;

export const scopedHtmlPatchSchema = z.object({
  id: z.string().min(1),
  html: z
    .string()
    .min(1)
    .refine((value) => !styleTagPattern.test(value), {
      message: "html must not contain style tags",
    }),
});

export const scopedHtmlPatchResultSchema = z.object({
  patches: z.array(scopedHtmlPatchSchema).min(1).max(8),
});

export interface ScopedHtmlPatch {
  id: string;
  html: string;
}

export interface ScopedHtmlPatchResult {
  patches: ScopedHtmlPatch[];
}
