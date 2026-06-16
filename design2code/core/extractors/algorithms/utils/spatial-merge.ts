import type { SimplifiedNode } from "../../../types/extractor-types.js";
import type { BoundingBox } from "../../../types/simplified-types.js";
import { getUnionRect } from "../../../utils/geometry.js";

const ANCHOR_ALIGNMENT_THRESHOLD = 8;
const SPATIAL_NEIGHBOR_GAP_THRESHOLD = 12;
const UNION_AREA_EXPANSION_RATIO = 1.5;

export function shouldMergeAdjacentGroups(
  firstGroup: SimplifiedNode[],
  secondGroup: SimplifiedNode[],
  axis: "x" | "y"
): boolean {
  const firstRect = getGroupRect(firstGroup);
  const secondRect = getGroupRect(secondGroup);
  if (!firstRect || !secondRect) return false;

  return (
    isSpatialNeighbor(firstRect, secondRect, axis) &&
    hasSharedAnchor(firstRect, secondRect, axis) &&
    isCompactUnion(firstRect, secondRect)
  );
}

function getGroupRect(group: SimplifiedNode[]): BoundingBox | null {
  const rects = group.map(n => n.absRect).filter((r): r is BoundingBox => !!r);
  if (rects.length === 0) return null;
  return getUnionRect(rects);
}

function isSpatialNeighbor(
  firstRect: BoundingBox,
  secondRect: BoundingBox,
  axis: "x" | "y"
): boolean {
  return calculateAxisGap(firstRect, secondRect, axis) <= SPATIAL_NEIGHBOR_GAP_THRESHOLD;
}

function hasSharedAnchor(firstRect: BoundingBox, secondRect: BoundingBox, axis: "x" | "y"): boolean {
  const crossAxis = axis === "x" ? "y" : "x";
  const startDelta = Math.abs(firstRect[crossAxis] - secondRect[crossAxis]);
  const centerDelta = Math.abs(getRectCenter(firstRect, crossAxis) - getRectCenter(secondRect, crossAxis));
  const endDelta = Math.abs(getRectEnd(firstRect, crossAxis) - getRectEnd(secondRect, crossAxis));
  return Math.min(startDelta, centerDelta, endDelta) <= ANCHOR_ALIGNMENT_THRESHOLD;
}

function isCompactUnion(firstRect: BoundingBox, secondRect: BoundingBox): boolean {
  const unionRect = getUnionRect([firstRect, secondRect]);
  const unionArea = getRectArea(unionRect);
  const sourceArea = getRectArea(firstRect) + getRectArea(secondRect);
  if (sourceArea === 0) return false;
  return unionArea <= sourceArea * UNION_AREA_EXPANSION_RATIO;
}

function getRectCenter(rect: BoundingBox, axis: "x" | "y"): number {
  return rect[axis] + getRectSize(rect, axis) / 2;
}

function getRectEnd(rect: BoundingBox, axis: "x" | "y"): number {
  return rect[axis] + getRectSize(rect, axis);
}

function getRectSize(rect: BoundingBox, axis: "x" | "y"): number {
  return axis === "x" ? rect.width : rect.height;
}

function calculateAxisGap(firstRect: BoundingBox, secondRect: BoundingBox, axis: "x" | "y"): number {
  return Math.max(0, secondRect[axis] - getRectEnd(firstRect, axis));
}

function getRectArea(rect: BoundingBox): number {
  return rect.width * rect.height;
}
