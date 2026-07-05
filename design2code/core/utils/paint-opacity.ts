import type { SimplifiedNode } from "../types/extractor-types.js";

export type OpaqueOccluderRule =
  | "accept-single-opaque-solid-rectangle"
  | "reject-text-or-svg"
  | "reject-opacity-less-than-1"
  | "reject-non-normal-blend-mode"
  | "reject-image"
  | "reject-not-single-opaque-solid-fill"
  | "reject-border-radius";

export interface OpaqueOccluderEvaluation {
  result: boolean;
  rule: OpaqueOccluderRule;
}

// 判断节点是否可作为完全不透明的矩形遮挡层。
export function evaluateOpaqueOccluder(node: SimplifiedNode, fills: unknown): OpaqueOccluderEvaluation {
  if (node.type === "TEXT" || node.type === "SVG") return { result: false, rule: "reject-text-or-svg" };
  if (node.opacity !== undefined && node.opacity < 1) return { result: false, rule: "reject-opacity-less-than-1" };
  if (node.blendMode && node.blendMode !== "normal") return { result: false, rule: "reject-non-normal-blend-mode" };
  if (node.type === "IMAGE") return { result: false, rule: "reject-image" };
  if (!isSingleOpaqueSolidFill(fills)) return { result: false, rule: "reject-not-single-opaque-solid-fill" };
  if (node.borderRadius && node.borderRadius !== "0px" && node.borderRadius !== "0") {
    return { result: false, rule: "reject-border-radius" };
  }
  return { result: true, rule: "accept-single-opaque-solid-rectangle" };
}

// 判断填充是否为单一完全不透明 solid。
export function isSingleOpaqueSolidFill(fills: unknown): boolean {
  if (typeof fills === "string") return isOpaqueCssColor(fills);
  if (!Array.isArray(fills) || fills.length !== 1) return false;

  const fill = fills[0];
  if (typeof fill === "string") return isOpaqueCssColor(fill);
  if (!fill || typeof fill !== "object") return false;

  const paint = fill as { type?: string; visible?: boolean; opacity?: number; color?: unknown; blendMode?: string };
  if (paint.visible === false) return false;
  if ((paint.opacity ?? 1) < 1) return false;
  if (paint.type !== "SOLID") return false;
  if (paint.blendMode && paint.blendMode !== "normal") return false;
  return typeof paint.color === "string" && isOpaqueCssColor(paint.color);
}

// 判断 CSS 颜色字符串是否可视为完全不透明。
export function isOpaqueCssColor(value: string): boolean {
  const color = value.trim().toLowerCase();
  if (!color || color === "transparent") return false;
  if (color.startsWith("var(")) {
    const fallback = getCssVarFallback(color);
    return fallback ? isOpaqueCssColor(fallback) : false;
  }
  if (color === "black" || color === "white") return true;
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(color)) return true;
  if (color.startsWith("rgb(")) return true;
  if (!color.startsWith("rgba(")) return false;

  const alpha = Number(color.replace("rgba(", "").replace(")", "").split(",")[3]);
  return Number.isFinite(alpha) && alpha >= 1;
}

// 提取 CSS var 的 fallback 颜色。
function getCssVarFallback(value: string): string | null {
  const match = value.match(/^var\((.+)\)$/);
  if (!match) return null;

  const commaIndex = match[1].indexOf(",");
  if (commaIndex === -1) return null;
  return match[1].slice(commaIndex + 1).trim();
}
