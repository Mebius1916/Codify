import { v4 as uuidv4 } from "uuid";
import type { SimplifiedNode } from "../../../types/extractor-types.js";
import type { BoundingBox } from "../../../types/simplified-types.js";
import { getUnionRect } from "../../../utils/geometry.js";
import type { SimplifiedLayout } from "../../../types/simplified-types.js";;

export interface CreateVirtualFrameOptions {
  idPrefix?: string;
  name?: string;
  type?: "CONTAINER";
  layout?: SimplifiedLayout;
  children: SimplifiedNode[];
  // Additional props
  semanticTag?: 
    "list" | "icon" | "group" | "button" | "input" |
    "section" | "header" | "footer" | "nav" | "article" |
    "aside" | "main" | "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  visualSignature?: string;
  needsDownstreamProcessing?: boolean;
}

// 创建基础容器
export function createVirtualFrame(options: CreateVirtualFrameOptions): SimplifiedNode {

  const { 
    idPrefix = "virtual",
    name = "Virtual Container", 
    type = "CONTAINER",
    layout,
    children,
    semanticTag,
    visualSignature,
    needsDownstreamProcessing = true
  } = options;

  if (layout && typeof layout === "object") {
    const nextParentMode =
      layout.mode === "row" || layout.mode === "column" ? layout.mode : "none";
    for (const child of children) {
      if (typeof child.layout === "object" && child.layout) {
        // Fix: Absolute children should not inherit parent layout mode (they are out of flow)
        const isAbsolute = child.layout.position === "absolute";
        child.layout = {
          ...child.layout,
          parentMode: isAbsolute ? "none" : nextParentMode,
        };
      }
    }
  }

  const rects = children.map(c => c.absRect).filter((r): r is BoundingBox => !!r);
  const unionRect = getUnionRect(rects); // 获取总包围盒

  const node: SimplifiedNode = {
    id: `${idPrefix}-${uuidv4()}`,
    name,
    type,
    absRect: unionRect, // 默认自带总包围盒
    children,
    semanticTag,
    visualSignature,
    needsDownstreamProcessing
  };

  if (layout) {
    node.layout = layout;
  }

  return node;
}
