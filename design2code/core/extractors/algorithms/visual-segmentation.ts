import type { SimplifiedNode } from "../../types/extractor-types.js";
import type { BoundingBox } from "../../types/simplified-types.js";
import { getRectArea, getUnionRect } from "../../utils/geometry.js";
import { buildContainerByGap } from "./utils/layout-inference.js";

type Axis = "x" | "y";
type Direction = "row" | "column";

type Region = {
  nodes: SimplifiedNode[];
  rect: BoundingBox;
  parent?: SimplifiedNode;
  depth: number;
};

type Separator = {
  axis: Axis;
  coordinate: number;
  gapStart: number;
  gapEnd: number;
  gapSize: number;
  kind: "whitespace" | "container-boundary" | "alignment-shift";
  score: number;
  confidence: number;
  partitions: [SimplifiedNode[], SimplifiedNode[]];
};

type SegmentTree =
  | {
      kind: "leaf";
      nodes: SimplifiedNode[];
      rect: BoundingBox;
    }
  | {
      kind: "branch";
      direction: Direction;
      rect: BoundingBox;
      confidence: number;
      children: SegmentTree[];
    };

const MAX_DEPTH = 8;
const MIN_REGION_SIZE = 12;
const MIN_CONFIDENCE = 1.15;

export function groupNodesByVisualSegmentation(
  nodes: SimplifiedNode[],
  parent?: SimplifiedNode
): SimplifiedNode[] {
  const flowNodes: SimplifiedNode[] = [];
  const absoluteNodes: SimplifiedNode[] = [];

  for (const node of nodes) {
    if (typeof node.layout === "object" && node.layout?.position === "absolute") {
      absoluteNodes.push(node);
    } else {
      flowNodes.push(node);
    }
  }

  if (flowNodes.length <= 1) return [...flowNodes, ...absoluteNodes];

  const rect = getRegionRect(flowNodes, parent);
  if (!isUsefulRect(rect)) return [...flowNodes, ...absoluteNodes];

  const tree = buildSegmentTree({ nodes: flowNodes, rect, parent, depth: 0 });
  return [...materializeTree(tree, parent, true), ...absoluteNodes];
}

function buildSegmentTree(region: Region): SegmentTree {
  if (shouldStop(region)) {
    return { kind: "leaf", nodes: sortNodesForReading(region.nodes), rect: region.rect };
  }

  const separators = findSeparators(region);
  const best = pickBestSeparator(separators);

  if (!best || best.confidence < MIN_CONFIDENCE) {
    return { kind: "leaf", nodes: sortNodesForReading(region.nodes), rect: region.rect };
  }

  const children = best.partitions
    .filter((part) => part.length > 0)
    .map((part) =>
      buildSegmentTree({
        nodes: sortPartition(part, best.axis),
        rect: getRegionRect(part, region.parent),
        parent: region.parent,
        depth: region.depth + 1,
      })
    );

  if (children.length <= 1) {
    return { kind: "leaf", nodes: sortNodesForReading(region.nodes), rect: region.rect };
  }

  return {
    kind: "branch",
    direction: best.axis === "x" ? "row" : "column",
    rect: region.rect,
    confidence: best.confidence,
    children,
  };
}

function findSeparators(region: Region): Separator[] {
  const candidates = [
    ...findWhitespaceSeparators(region, "x"),
    ...findWhitespaceSeparators(region, "y"),
    ...findBoundarySeparators(region, "x"),
    ...findBoundarySeparators(region, "y"),
    ...findAlignmentShiftSeparators(region, "x"),
    ...findAlignmentShiftSeparators(region, "y"),
  ];

  return candidates
    .map((candidate) => scoreSeparator(candidate, region))
    .filter((candidate): candidate is Separator => !!candidate && candidate.partitions[0].length > 0 && candidate.partitions[1].length > 0);
}

function findWhitespaceSeparators(region: Region, axis: Axis): Omit<Separator, "score" | "confidence" | "partitions">[] {
  const participants = region.nodes.filter((node) => participatesInSeparator(node, region.rect));
  if (participants.length < 2) return [];

  const intervals = participants
    .map((node) => {
      const rect = node.absRect;
      if (!rect) return null;
      return {
        start: rect[axis],
        end: rect[axis] + getAxisSize(rect, axis),
      };
    })
    .filter((item): item is { start: number; end: number } => !!item)
    .sort((a, b) => a.start - b.start);

  if (intervals.length < 2) return [];

  const merged: { start: number; end: number }[] = [];
  for (const interval of intervals) {
    const last = merged[merged.length - 1];
    if (!last || interval.start > last.end + 0.5) {
      merged.push({ ...interval });
    } else {
      last.end = Math.max(last.end, interval.end);
    }
  }

  const minGap = computeMinUsefulGap(region, axis);
  const separators: Omit<Separator, "score" | "confidence" | "partitions">[] = [];

  for (let i = 1; i < merged.length; i++) {
    const gapStart = merged[i - 1].end;
    const gapEnd = merged[i].start;
    const gapSize = gapEnd - gapStart;
    if (gapSize < minGap) continue;

    separators.push({
      axis,
      coordinate: gapStart + gapSize / 2,
      gapStart,
      gapEnd,
      gapSize,
      kind: "whitespace",
    });
  }

  return separators;
}

function findBoundarySeparators(region: Region, axis: Axis): Omit<Separator, "score" | "confidence" | "partitions">[] {
  const tolerance = computeMinUsefulGap(region, axis) * 1.5;
  const regionStart = region.rect[axis];
  const regionEnd = regionStart + getAxisSize(region.rect, axis);
  const separators: Omit<Separator, "score" | "confidence" | "partitions">[] = [];

  for (const node of region.nodes) {
    const rect = node.absRect;
    if (!rect || !hasVisualBoundary(node)) continue;

    const start = rect[axis];
    const end = start + getAxisSize(rect, axis);
    for (const coordinate of [start, end]) {
      if (coordinate <= regionStart + 1 || coordinate >= regionEnd - 1) continue;
      const parts = partitionByCoordinate(region.nodes, axis, coordinate);
      if (parts[0].length === 0 || parts[1].length === 0) continue;

      const nearestGap = nearestWhitespaceAround(region, axis, coordinate);
      separators.push({
        axis,
        coordinate,
        gapStart: coordinate - Math.min(tolerance, nearestGap / 2),
        gapEnd: coordinate + Math.min(tolerance, nearestGap / 2),
        gapSize: nearestGap,
        kind: "container-boundary",
      });
    }
  }

  return dedupeSeparators(separators, axis, tolerance);
}

function findAlignmentShiftSeparators(region: Region, axis: Axis): Omit<Separator, "score" | "confidence" | "partitions">[] {
  const sorted = sortPartition(region.nodes.filter((node) => !!node.absRect), axis);
  if (sorted.length < 4) return [];

  const minGap = computeMinUsefulGap(region, axis) * 0.75;
  const separators: Omit<Separator, "score" | "confidence" | "partitions">[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].absRect;
    const next = sorted[i].absRect;
    if (!prev || !next) continue;

    const prevEnd = prev[axis] + getAxisSize(prev, axis);
    const nextStart = next[axis];
    const gapSize = nextStart - prevEnd;
    if (gapSize < minGap) continue;

    const before = sorted.slice(0, i);
    const after = sorted.slice(i);
    const beforeCross = crossAxisAlignmentVariance(before, axis);
    const afterCross = crossAxisAlignmentVariance(after, axis);
    const wholeCross = crossAxisAlignmentVariance(sorted, axis);

    if (wholeCross <= 0 || beforeCross + afterCross >= wholeCross * 0.85) continue;

    separators.push({
      axis,
      coordinate: prevEnd + gapSize / 2,
      gapStart: prevEnd,
      gapEnd: nextStart,
      gapSize,
      kind: "alignment-shift",
    });
  }

  return separators;
}

function scoreSeparator(
  separator: Omit<Separator, "score" | "confidence" | "partitions">,
  region: Region
): Separator | null {
  const partitions = partitionByCoordinate(region.nodes, separator.axis, separator.coordinate);
  if (partitions[0].length === 0 || partitions[1].length === 0) return null;

  const regionSize = getAxisSize(region.rect, separator.axis);
  if (regionSize <= 0) return null;

  const whitespaceScore = clamp(separator.gapSize / Math.max(1, regionSize), 0, 1) * 3.2;
  const balanceScore = calculateBalanceScore(partitions) * 1.6;
  const alignmentGainScore = calculateAlignmentGain(region.nodes, partitions, separator.axis) * 1.7;
  const boundaryScore = calculateBoundaryScore(separator, region) * 1.1;
  const styleShiftScore = calculateTypeShiftScore(partitions) * 0.7;
  const readingOrderScore = calculateReadingOrderScore(partitions, separator.axis) * 0.5;
  const cutPenalty = calculateCutThroughPenalty(region.nodes, separator) * 3.4;
  const fragmentationPenalty = calculateFragmentationPenalty(partitions) * 0.8;
  const kindBoost = separator.kind === "whitespace" ? 0.25 : separator.kind === "container-boundary" ? 0.15 : 0;

  const score =
    whitespaceScore +
    balanceScore +
    alignmentGainScore +
    boundaryScore +
    styleShiftScore +
    readingOrderScore +
    kindBoost -
    cutPenalty -
    fragmentationPenalty;

  return {
    ...separator,
    partitions,
    score,
    confidence: 0,
  };
}

function pickBestSeparator(separators: Separator[]): Separator | null {
  if (separators.length === 0) return null;

  const scored = separators
    .filter((separator) => Number.isFinite(separator.score))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const scores = scored.map((separator) => separator.score).sort((a, b) => a - b);
  const median = percentile(scores, 0.5);
  const iqr = Math.max(0.15, percentile(scores, 0.75) - percentile(scores, 0.25));
  const best = scored[0];
  const second = scored[1]?.score ?? median;
  const margin = best.score - second;
  best.confidence = Math.max(best.score, (best.score - median) / iqr + margin * 0.25);

  return best.score > 1.2 ? best : null;
}

function materializeTree(tree: SegmentTree, parent: SimplifiedNode | undefined, isRoot: boolean): SimplifiedNode[] {
  if (tree.kind === "leaf") {
    return sortNodesForReading(tree.nodes);
  }

  const children = tree.children.flatMap((child) => materializeTree(child, parent, false));
  const sortedChildren = sortByDirection(children, tree.direction);

  if (isRoot) return sortedChildren;

  return [
    buildContainerByGap({
      name: "Visual Segment",
      idPrefix: "virtual-visual-segment",
      children: sortedChildren,
      direction: tree.direction,
      allowSingle: true,
      parent,
    }),
  ];
}

function shouldStop(region: Region): boolean {
  if (region.nodes.length <= 2) return true;
  if (region.depth >= MAX_DEPTH) return true;
  if (region.rect.width < MIN_REGION_SIZE || region.rect.height < MIN_REGION_SIZE) return true;
  return false;
}

function participatesInSeparator(node: SimplifiedNode, regionRect: BoundingBox): boolean {
  const rect = node.absRect;
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  if (node.type === "TEXT" || node.type === "SVG" || node.type === "IMAGE") return true;
  if (node.children && node.children.length > 0) return true;

  const regionArea = Math.max(1, getRectArea(regionRect));
  const areaRatio = getRectArea(rect) / regionArea;
  const coversMostRegion =
    rect.width >= regionRect.width * 0.9 && rect.height >= regionRect.height * 0.9;

  return areaRatio < 0.72 && !coversMostRegion;
}

function hasVisualBoundary(node: SimplifiedNode): boolean {
  return Boolean(node.fills || node.strokes || node.strokeWeight || node.borderRadius || node.effects);
}

function partitionByCoordinate(nodes: SimplifiedNode[], axis: Axis, coordinate: number): [SimplifiedNode[], SimplifiedNode[]] {
  const before: SimplifiedNode[] = [];
  const after: SimplifiedNode[] = [];

  for (const node of nodes) {
    const rect = node.absRect;
    if (!rect) {
      before.push(node);
      continue;
    }

    const center = rect[axis] + getAxisSize(rect, axis) / 2;
    if (center < coordinate) before.push(node);
    else after.push(node);
  }

  return [before, after];
}

function calculateBalanceScore(parts: [SimplifiedNode[], SimplifiedNode[]]): number {
  const [a, b] = parts;
  const countBalance = Math.min(a.length, b.length) / Math.max(a.length, b.length);
  const areaA = Math.max(1, sumArea(a));
  const areaB = Math.max(1, sumArea(b));
  const areaBalance = Math.min(areaA, areaB) / Math.max(areaA, areaB);
  return (countBalance + areaBalance) / 2;
}

function calculateAlignmentGain(nodes: SimplifiedNode[], parts: [SimplifiedNode[], SimplifiedNode[]], axis: Axis): number {
  const before = crossAxisAlignmentVariance(nodes, axis);
  if (before <= 0) return 0;
  const after =
    (crossAxisAlignmentVariance(parts[0], axis) * parts[0].length +
      crossAxisAlignmentVariance(parts[1], axis) * parts[1].length) /
    Math.max(1, nodes.length);
  return clamp((before - after) / before, 0, 1);
}

function crossAxisAlignmentVariance(nodes: SimplifiedNode[], splitAxis: Axis): number {
  const crossAxis: Axis = splitAxis === "x" ? "y" : "x";
  const centers = nodes
    .map((node) => {
      const rect = node.absRect;
      return rect ? rect[crossAxis] + getAxisSize(rect, crossAxis) / 2 : null;
    })
    .filter((value): value is number => value !== null);

  if (centers.length <= 1) return 0;
  const median = percentile([...centers].sort((a, b) => a - b), 0.5);
  const deviations = centers.map((value) => Math.abs(value - median)).sort((a, b) => a - b);
  return percentile(deviations, 0.5);
}

function calculateBoundaryScore(separator: Omit<Separator, "score" | "confidence" | "partitions">, region: Region): number {
  const tolerance = Math.max(3, computeMinUsefulGap(region, separator.axis));
  let best = 0;

  for (const node of region.nodes) {
    const rect = node.absRect;
    if (!rect || !hasVisualBoundary(node)) continue;
    const start = rect[separator.axis];
    const end = start + getAxisSize(rect, separator.axis);
    const distance = Math.min(Math.abs(separator.coordinate - start), Math.abs(separator.coordinate - end));
    if (distance <= tolerance) {
      best = Math.max(best, 1 - distance / tolerance);
    }
  }

  return best;
}

function calculateTypeShiftScore(parts: [SimplifiedNode[], SimplifiedNode[]]): number {
  const left = typeDistribution(parts[0]);
  const right = typeDistribution(parts[1]);
  const types = new Set([...Object.keys(left), ...Object.keys(right)]);
  let diff = 0;
  for (const type of types) {
    diff += Math.abs((left[type] ?? 0) - (right[type] ?? 0));
  }
  return clamp(diff / 2, 0, 1);
}

function calculateReadingOrderScore(parts: [SimplifiedNode[], SimplifiedNode[]], axis: Axis): number {
  const first = getUnionRect(parts[0].map((node) => node.absRect).filter((rect): rect is BoundingBox => !!rect));
  const second = getUnionRect(parts[1].map((node) => node.absRect).filter((rect): rect is BoundingBox => !!rect));
  if (!isUsefulRect(first) || !isUsefulRect(second)) return 0;
  return first[axis] <= second[axis] ? 1 : 0;
}

function calculateCutThroughPenalty(
  nodes: SimplifiedNode[],
  separator: Omit<Separator, "score" | "confidence" | "partitions">
): number {
  let penalty = 0;
  const bandStart = Math.min(separator.gapStart, separator.gapEnd);
  const bandEnd = Math.max(separator.gapStart, separator.gapEnd);

  for (const node of nodes) {
    const rect = node.absRect;
    if (!rect) continue;
    const start = rect[separator.axis];
    const end = start + getAxisSize(rect, separator.axis);
    const crossesCoordinate = start < separator.coordinate && end > separator.coordinate;
    const crossesBand = start < bandEnd && end > bandStart;
    if (!crossesCoordinate && !crossesBand) continue;

    if (node.type === "TEXT" || node.type === "SVG" || node.type === "IMAGE") penalty += 1;
    else if (participatesInSeparator(node, getUnionRect(nodes.map((item) => item.absRect).filter((r): r is BoundingBox => !!r)))) penalty += 0.75;
    else penalty += 0.15;
  }

  return Math.min(1.5, penalty / Math.max(1, nodes.length));
}

function calculateFragmentationPenalty(parts: [SimplifiedNode[], SimplifiedNode[]]): number {
  const minCount = Math.min(parts[0].length, parts[1].length);
  return minCount === 1 ? 0.45 : 0;
}

function nearestWhitespaceAround(region: Region, axis: Axis, coordinate: number): number {
  let beforeEnd = region.rect[axis];
  let afterStart = region.rect[axis] + getAxisSize(region.rect, axis);

  for (const node of region.nodes) {
    const rect = node.absRect;
    if (!rect) continue;
    const start = rect[axis];
    const end = start + getAxisSize(rect, axis);
    if (end <= coordinate) beforeEnd = Math.max(beforeEnd, end);
    if (start >= coordinate) afterStart = Math.min(afterStart, start);
  }

  return Math.max(0, afterStart - beforeEnd);
}

function computeMinUsefulGap(region: Region, axis: Axis): number {
  const sizes = region.nodes
    .map((node) => node.absRect)
    .filter((rect): rect is BoundingBox => !!rect)
    .map((rect) => getAxisSize(rect, axis))
    .sort((a, b) => a - b);

  const medianNodeSize = sizes.length > 0 ? percentile(sizes, 0.5) : 0;
  return Math.max(4, getAxisSize(region.rect, axis) * 0.015, medianNodeSize * 0.08);
}

function getRegionRect(nodes: SimplifiedNode[], parent?: SimplifiedNode): BoundingBox {
  const rects = nodes.map((node) => node.absRect).filter((rect): rect is BoundingBox => !!rect);
  if (rects.length > 0) return getUnionRect(rects);
  if (parent?.absRect) return parent.absRect;
  return { x: 0, y: 0, width: 0, height: 0 };
}

function getAxisSize(rect: BoundingBox, axis: Axis): number {
  return axis === "x" ? rect.width : rect.height;
}

function sortPartition(nodes: SimplifiedNode[], axis: Axis): SimplifiedNode[] {
  return [...nodes].sort((a, b) => {
    const rectA = a.absRect;
    const rectB = b.absRect;
    const primaryA = rectA ? rectA[axis] : 0;
    const primaryB = rectB ? rectB[axis] : 0;
    if (primaryA !== primaryB) return primaryA - primaryB;
    const crossAxis: Axis = axis === "x" ? "y" : "x";
    return (rectA ? rectA[crossAxis] : 0) - (rectB ? rectB[crossAxis] : 0);
  });
}

function sortByDirection(nodes: SimplifiedNode[], direction: Direction): SimplifiedNode[] {
  return sortPartition(nodes, direction === "row" ? "x" : "y");
}

function sortNodesForReading(nodes: SimplifiedNode[]): SimplifiedNode[] {
  return [...nodes].sort((a, b) => {
    const rectA = a.absRect;
    const rectB = b.absRect;
    const yDiff = (rectA?.y ?? 0) - (rectB?.y ?? 0);
    if (Math.abs(yDiff) > 2) return yDiff;
    return (rectA?.x ?? 0) - (rectB?.x ?? 0);
  });
}

function dedupeSeparators<T extends Omit<Separator, "score" | "confidence" | "partitions">>(
  separators: T[],
  axis: Axis,
  tolerance: number
): T[] {
  return separators
    .sort((a, b) => a.coordinate - b.coordinate)
    .filter((separator, index, all) => {
      if (separator.axis !== axis) return true;
      const prev = all[index - 1];
      return !prev || Math.abs(separator.coordinate - prev.coordinate) > tolerance;
    });
}

function typeDistribution(nodes: SimplifiedNode[]): Record<string, number> {
  const total = Math.max(1, nodes.length);
  const counts: Record<string, number> = {};
  for (const node of nodes) {
    counts[node.type] = (counts[node.type] ?? 0) + 1;
  }
  for (const key of Object.keys(counts)) {
    counts[key] = counts[key] / total;
  }
  return counts;
}

function sumArea(nodes: SimplifiedNode[]): number {
  return nodes.reduce((sum, node) => sum + getRectArea(node.absRect), 0);
}

function isUsefulRect(rect: BoundingBox): boolean {
  return rect.width > 0 && rect.height > 0;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
