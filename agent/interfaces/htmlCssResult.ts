import { z } from "zod";

const styleTagPattern = /<\/?style(?:\s|>|\/)/i;

export const htmlCssResultSchema = z.object({
  html: z
    .string()
    .min(1)
    .refine((value) => !styleTagPattern.test(value), {
      message: "html must not contain style tags",
    }),
  css: z.string().refine((value) => !styleTagPattern.test(value), {
    message: "css must not contain style tags",
  }),
  removedDataIds: z.array(z.string()).default([]),
});

export interface HtmlCssResult {
  html: string;
  css: string;
  removedDataIds?: string[];
}
