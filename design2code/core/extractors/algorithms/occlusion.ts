import type { SimplifiedNode } from "../../types/extractor-types.js";
import { subtractRect, getNodeBoundingBox } from "../../utils/geometry.js";
import { hasVisibleStyles } from "../../utils/node-check.js";
import type { BoundingBox } from "../../types/simplified-types.js";
import type { TraversalContext } from "../../types/extractor-types.js";
import { resolveNodeFills } from "./utils/check-fills.js";
import { evaluateOpaqueOccluder, isOpaqueCssColor, type OpaqueOccluderEvaluation } from "../../utils/paint-opacity.js";
import type {
  OcclusionInstrumentationStrategy,
  FillStats,
  OccluderDecisionRecord,
  OcclusionDecisionRecord,
  VisibleContentRule,
  VisibleContentStats,
} from "../../instrumentation/strategies/occlusion.js";

// 移除被上层不透明兄弟节点完全遮挡的节点，并可选记录 AI 证据。
export function removeOccludedNodes(
  nodes: SimplifiedNode[],
  globalVars?: TraversalContext["globalVars"],
  instrumentation?: OcclusionInstrumentationStrategy,
): SimplifiedNode[] {
  if (nodes.length === 0) {
    return [];
  }

  const visibleNodes: SimplifiedNode[] = []; // 有效节点
  const occluders: BoundingBox[] = []; // 遮罩层

  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const rect = getNodeBoundingBox(node);

    // Skip nodes with invalid geometry
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      instrumentation?.recordInvalidGeometry();
      continue;
    }

    // 当前节点的几何区域
    let remainingRegions = [rect];

    // 遍历所有遮罩层，计算当前节点的可见区域
    for (const occluder of occluders) {
      const nextRegions: BoundingBox[] = [];
      for (const region of remainingRegions) {
        nextRegions.push(...subtractRect(region, occluder));
      }
      remainingRegions = nextRegions;
      
      // 如果当前节点的可见区域为空，说明当前节点被完全遮挡
      if (remainingRegions.length === 0) {
        break;
      }
    }

    // 判断当前节点露出部分是否有可见内容
    const visibleContent = getVisibleContent(node, remainingRegions);
    const isOccluded = remainingRegions.length === 0 || !visibleContent.result;
    instrumentation?.recordNodeDecision(toNodeDecision(
      node,
      rect,
      remainingRegions,
      occluders,
      isOccluded,
      visibleContent.rule,
      visibleContent.stats,
    ));

    if (!isOccluded) {
      visibleNodes.unshift(node);

      // 加入遮罩层
      const fills = resolveNodeFills(node, globalVars);
      const opaqueEvaluation = evaluateOpaqueOccluder(node, fills);
      instrumentation?.recordOccluderDecision(toOccluderDecision(node, fills, opaqueEvaluation));
      if (opaqueEvaluation.result) {
        occluders.push(rect);
      }
    }
  }

  instrumentation?.recordStage(nodes.length, visibleNodes.length);
  return visibleNodes;
}

// 判断节点在剩余区域中是否仍有可见内容。
function getVisibleContent(
  node: SimplifiedNode,
  regions: BoundingBox[],
): { result: boolean; rule: VisibleContentRule; stats: VisibleContentStats } {
  const emptyStats = { hitChildCount: 0, maxChildIntersectionAreaRatio: 0 };
  if (node.type === "TEXT" || node.type === "SVG" || node.type === "IMAGE") {
    return { result: true, rule: "leaf-node", stats: emptyStats };
  }
  if (hasVisibleStyles(node)) return { result: true, rule: "visible-style", stats: emptyStats };

  const childHit = collectChildHit(node.children ?? [], regions);
  if (childHit.hitChildCount > 0) {
    return { result: true, rule: "child-intersection", stats: childHit };
  }
  return { result: false, rule: "no-visible-content", stats: emptyStats };
}

// 将节点遮挡结果整理为 instrumentation 记录。
function toNodeDecision(
  node: SimplifiedNode,
  rect: BoundingBox,
  remainingRegions: BoundingBox[],
  occluders: BoundingBox[],
  isOccluded: boolean,
  visibleContentRule: VisibleContentRule,
  visibleContentStats: VisibleContentStats,
): OcclusionDecisionRecord {
  const originalArea = getArea(rect);
  const remainingArea = remainingRegions.reduce((sum, region) => sum + getArea(region), 0);
  return {
    id: node.id,
    name: node.name,
    nodeType: node.type,
    action: isOccluded ? "remove" : "keep",
    reason: remainingRegions.length === 0 ? "fully-covered" : visibleContentRule,
    remainingAreaRatio: originalArea > 0 ? remainingArea / originalArea : 0,
    remainingRegionCount: remainingRegions.length,
    visibleContentRule,
    hitChildCount: visibleContentStats.hitChildCount,
    maxChildIntersectionAreaRatio: visibleContentStats.maxChildIntersectionAreaRatio,
    occluderInfluenceCount: countOverlappingOccluders(rect, occluders),
  };
}

// 将遮挡层资格判断整理为 instrumentation 记录。
function toOccluderDecision(
  node: SimplifiedNode,
  fills: unknown,
  opaqueEvaluation: OpaqueOccluderEvaluation,
): OccluderDecisionRecord {
  const fillStats = describeFill(fills);
  return {
    id: node.id,
    name: node.name,
    nodeType: node.type,
    action: opaqueEvaluation.result ? "add-occluder" : "reject-occluder",
    opaqueRule: opaqueEvaluation.rule,
    opacity: node.opacity,
    blendMode: node.blendMode,
    borderRadius: node.borderRadius,
    ...fillStats,
  };
}

// 统计当前节点与多少个已接受遮挡层发生重叠。
function countOverlappingOccluders(rect: BoundingBox, occluders: BoundingBox[]): number {
  return occluders.filter((occluder) => getIntersectionArea(rect, occluder) > 0).length;
}

// 统计子节点与剩余可见区域的命中情况。
function collectChildHit(children: SimplifiedNode[], regions: BoundingBox[]) {
  let hitChildCount = 0;
  let maxChildIntersectionAreaRatio = 0;
  for (const child of children) {
    const childRect = getNodeBoundingBox(child);
    if (!childRect) continue;
    const intersectionArea = regions.reduce((sum, region) => sum + getIntersectionArea(childRect, region), 0);
    if (intersectionArea <= 0) continue;
    hitChildCount += 1;
    maxChildIntersectionAreaRatio = Math.max(
      maxChildIntersectionAreaRatio,
      getArea(childRect) > 0 ? intersectionArea / getArea(childRect) : 0,
    );
  }
  return { hitChildCount, maxChildIntersectionAreaRatio };
}

// 提取填充类型和不透明性摘要。
function describeFill(fills: unknown): FillStats {
  if (typeof fills === "string") return { fillKind: "css-color", fillColorOpaque: isOpaqueCssColor(fills) };
  if (!Array.isArray(fills)) return { fillKind: fills ? "unresolved" : "none" };
  if (fills.length !== 1) return { fillKind: fills.length > 1 ? "multi-paint" : "none" };
  const fill = fills[0];
  if (typeof fill === "string") return { fillKind: "css-color", fillColorOpaque: isOpaqueCssColor(fill) };
  if (!fill || typeof fill !== "object") return { fillKind: "unresolved" };
  const paint = fill as { color?: unknown };
  return {
    fillKind: "single-paint",
    fillColorOpaque: typeof paint.color === "string" ? isOpaqueCssColor(paint.color) : undefined,
  };
}

// 计算矩形面积，并防止负宽高产生负面积。
function getArea(rect: BoundingBox): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

// 计算两个矩形的相交面积。
function getIntersectionArea(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}
