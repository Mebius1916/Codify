import { z } from "zod";

const styleTagPattern = /<\/?style(?:\s|>|\/)/i;

export const htmlFragmentResultSchema = z.object({
  html: z
    .string()
    .min(1)
    .refine((value) => !styleTagPattern.test(value), {
      message: "html must not contain style tags",
    }),
});

export interface HtmlFragmentResult {
  html: string;
}
