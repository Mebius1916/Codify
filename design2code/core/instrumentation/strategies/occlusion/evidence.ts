import { resolveNodeFills } from "../../../extractors/algorithms/utils/check-fills.js";
import type { SimplifiedNode } from "../../../types/extractor-types.js";
import type { BoundingBox } from "../../../types/simplified-types.js";
import { getNodeBoundingBox } from "../../../utils/geometry.js";
import { hasVisibleStyles } from "../../../utils/node-check.js";
import type {
  AcceptedOccluderRecord,
  FillKind,
  OccluderDecisionRecord,
  OcclusionDecisionRecord,
  OpaqueDecision,
  VisibleContentDecision,
} from "./model.js";
import type {
  OcclusionNodeEvaluationInput,
  OcclusionOccluderEvaluationInput,
} from "./types.js";

export function createNodeDecision(
  input: OcclusionNodeEvaluationInput,
  acceptedOccluders: AcceptedOccluderRecord[],
): OcclusionDecisionRecord {
  const visibleContentDecision = explainVisibleContent(input.node, input.remainingRegions);
  return {
    node: toNodeBrief(input.node, input.rect),
    action: input.isOccluded ? "remove" : "keep",
    reason: input.remainingRegions.length === 0 ? "fully-covered" : visibleContentDecision.rule,
    geometry: createGeometry(input.rect, input.remainingRegions),
    visibleContentDecision,
    occluderInfluence: createOccluderInfluence(input.rect, acceptedOccluders, input.occluderRects),
  };
}

export function createOccluderDecision(input: OcclusionOccluderEvaluationInput): OccluderDecisionRecord {
  return {
    node: toNodeBrief(input.node, input.rect),
    action: input.isOpaque ? "add-occluder" : "reject-occluder",
    opaqueDecision: explainOpaque(input.node, input.globalVars),
  };
}

function explainVisibleContent(node: SimplifiedNode, regions: BoundingBox[]): VisibleContentDecision {
  const base = {
    checkedChildCount: node.children?.length ?? 0,
    hitChildCount: 0,
    maxChildIntersectionAreaRatio: 0,
  };

  if (node.type === "TEXT" || node.type === "SVG" || node.type === "IMAGE") {
    return { ...base, result: true, rule: "leaf-node" };
  }
  if (hasVisibleStyles(node)) return { ...base, result: true, rule: "visible-style" };

  const childHit = collectChildHit(node.children ?? [], regions);
  if (childHit.hitChildCount > 0) {
    return { ...base, ...childHit, result: true, rule: "child-intersection" };
  }
  return { ...base, result: false, rule: "no-visible-content" };
}

function explainOpaque(node: SimplifiedNode, globalVars?: OcclusionOccluderEvaluationInput["globalVars"]): OpaqueDecision {
  const fills = resolveNodeFills(node, globalVars);
  const checks = {
    nodeType: node.type,
    opacity: node.opacity,
    blendMode: node.blendMode,
    borderRadius: node.borderRadius,
    ...describeFill(fills),
  };

  if (node.type === "TEXT" || node.type === "SVG") return { result: false, rule: "reject-text-or-svg", checks };
  if (node.opacity !== undefined && node.opacity < 1) return { result: false, rule: "reject-opacity-less-than-1", checks };
  if (node.blendMode && node.blendMode !== "normal") return { result: false, rule: "reject-non-normal-blend-mode", checks };
  if (node.type === "IMAGE") return { result: false, rule: "reject-image", checks };
  if (!looksSingleOpaqueSolidFill(fills)) return { result: false, rule: "reject-not-single-opaque-solid-fill", checks };
  if (node.borderRadius && node.borderRadius !== "0px" && node.borderRadius !== "0") {
    return { result: false, rule: "reject-border-radius", checks };
  }
  return { result: true, rule: "accept-single-opaque-solid-rectangle", checks };
}

function toNodeBrief(node: SimplifiedNode, rect?: BoundingBox | null) {
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    rect: rect ?? node.absRect,
    hasVisibleStyle: hasVisibleStyles(node),
  };
}

function createGeometry(rect: BoundingBox, remainingRegions: BoundingBox[]) {
  const originalArea = getArea(rect);
  const remainingArea = remainingRegions.reduce((sum, region) => sum + getArea(region), 0);
  const largestRemainingArea = remainingRegions.reduce((max, region) => Math.max(max, getArea(region)), 0);
  return {
    originalArea,
    remainingArea,
    remainingAreaRatio: originalArea > 0 ? remainingArea / originalArea : 0,
    remainingRegionCount: remainingRegions.length,
    largestRemainingRegionRatio: originalArea > 0 ? largestRemainingArea / originalArea : 0,
  };
}

function createOccluderInfluence(
  rect: BoundingBox,
  acceptedOccluders: AcceptedOccluderRecord[],
  occluderRects: BoundingBox[],
) {
  const nodeArea = getArea(rect);
  return occluderRects.flatMap((occluderRect, index) => {
    const accepted = acceptedOccluders[index];
    const overlapArea = getIntersectionArea(rect, occluderRect);
    return accepted && overlapArea > 0
      ? [{
        node: toNodeBrief(accepted.node, accepted.rect),
        overlapArea,
        overlapRatioOfNode: nodeArea > 0 ? overlapArea / nodeArea : 0,
        opaqueRule: accepted.opaqueDecision.rule,
      }]
      : [];
  });
}

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

function looksSingleOpaqueSolidFill(fills: unknown): boolean {
  if (typeof fills === "string") return fills.trim().toLowerCase() !== "transparent";
  if (!Array.isArray(fills) || fills.length !== 1) return false;
  const fill = fills[0];
  if (typeof fill === "string") return fill.trim().toLowerCase() !== "transparent";
  if (!fill || typeof fill !== "object") return false;
  const paint = fill as { type?: string; visible?: boolean; opacity?: number; color?: unknown; blendMode?: string };
  return paint.visible !== false &&
    (paint.opacity ?? 1) >= 1 &&
    paint.type === "SOLID" &&
    (!paint.blendMode || paint.blendMode === "normal") &&
    typeof paint.color === "string";
}

function describeFill(fills: unknown): { fillKind: FillKind; fillColorOpaque?: boolean } {
  if (typeof fills === "string") return { fillKind: "css-color", fillColorOpaque: fills.trim().toLowerCase() !== "transparent" };
  if (!Array.isArray(fills)) return { fillKind: fills ? "unresolved" : "none" };
  if (fills.length !== 1) return { fillKind: fills.length > 1 ? "multi-paint" : "none" };
  const fill = fills[0];
  if (typeof fill === "string") return { fillKind: "css-color", fillColorOpaque: fill.trim().toLowerCase() !== "transparent" };
  if (!fill || typeof fill !== "object") return { fillKind: "unresolved" };
  const paint = fill as { color?: unknown };
  return {
    fillKind: "single-paint",
    fillColorOpaque: typeof paint.color === "string" ? paint.color.trim().toLowerCase() !== "transparent" : undefined,
  };
}

function getArea(rect: BoundingBox): number {
  return Math.max(0, rect.width) * Math.max(0, rect.height);
}

function getIntersectionArea(a: BoundingBox, b: BoundingBox): number {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.width, b.x + b.width);
  const y2 = Math.min(a.y + a.height, b.y + b.height);
  return Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
}
