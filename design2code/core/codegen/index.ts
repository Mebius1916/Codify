import type { SimplifiedDesign } from "../types/extractor-types.js";
import type { InstrumentationPacket } from "../instrumentation/types.js";
import { createCodegenContext } from "./context/index.js";
import { generateHTMLParts } from "./html/index.js";

export interface CodegenResult {
  html: string;
  css: string;
  body: string;
  size?: { width: number; height: number };
  instrumentation?: InstrumentationPacket[];
}

export default function codegen(design: SimplifiedDesign): CodegenResult {
  // 拷贝副本，避免污染原始对象
  const context = createCodegenContext(design);
  const parts = generateHTMLParts(design, context);
  return {
    html: parts.html,
    css: parts.css,
    body: parts.body,
    size: parts.size
  };
}
