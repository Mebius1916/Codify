import type { SimplifiedNode } from "../../../types/extractor-types.js";
import type { BoundingBox } from "../../../types/simplified-types.js";
import { getUnionRect } from "../../../utils/geometry.js";
import { shouldMergeAdjacentGroups } from "./spatial-merge.js";

// 计算分组的宽高相似度代价
export function calculateSimilarityCost(groups: SimplifiedNode[][]): number {
  if (groups.length <= 1) return 0;
  const sizes = groups.map(group => {
    const rects = group.map(n => n.absRect).filter((r): r is BoundingBox => !!r);
    const union = getUnionRect(rects);
    return union ? { width: union.width, height: union.height } : { width: 0, height: 0 };
  });

  const widths = sizes.map(s => s.width);
  const heights = sizes.map(s => s.height);

  const avgW = widths.reduce((a, b) => a + b, 0) / widths.length;
  const avgH = heights.reduce((a, b) => a + b, 0) / heights.length;
  if (avgW === 0 || avgH === 0) return 0;

  const varW = widths.reduce((sum, w) => sum + Math.pow(w - avgW, 2), 0) / widths.length;
  const varH = heights.reduce((sum, h) => sum + Math.pow(h - avgH, 2), 0) / heights.length;
  const stdW = Math.sqrt(varW);
  const stdH = Math.sqrt(varH);

  return (stdW / avgW) + (stdH / avgH);
}

// 计算行列斜率对齐代价
export function calculateAlignmentCost(groups: SimplifiedNode[][], direction: "row" | "column"): number {
  let totalSlope = 0;
  let validGroups = 0;
  for (const group of groups) {
    if (group.length <= 1) continue;
    // 取中心点位
    const points = group.map(n => {
      if (!n.absRect) return null;
      const cx = n.absRect.x + n.absRect.width / 2;
      const cy = n.absRect.y + n.absRect.height / 2;
      return { x: cx, y: cy };
    }).filter((p): p is { x: number; y: number } => !!p);
    if (points.length < 2) continue;
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    // 计算所有分散点的中心点位
    const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    if (direction === "row") {
      for (const p of points) {
        const dx = p.x - xMean;
        num += dx * (p.y - yMean);
        den += dx * dx;
      }
    } else {
      for (const p of points) {
        const dy = p.y - yMean;
        num += dy * (p.x - xMean);
        den += dy * dy;
      }
    }
    if (den === 0) continue;
    // 累加斜率
    totalSlope += Math.abs(num / den);
    validGroups++;
  }
  // 返回平均斜率
  return validGroups > 0 ? totalSlope / validGroups : 0;
}

// 投影分割算法
export function splitByProjection(nodes: SimplifiedNode[], axis: "x" | "y", minGap: number): SimplifiedNode[][] {
  if (nodes.length <= 1) return nodes.length === 0 ? [] : [nodes];
  // 按照集合顺序排序
  const sorted = [...nodes].sort((a, b) => {
    const rectA = a.absRect;
    const rectB = b.absRect;
    const startA = rectA ? rectA[axis] : 0;
    const startB = rectB ? rectB[axis] : 0;
    return startA - startB;
  });
  const groups: SimplifiedNode[][] = [];
  let currentGroup: SimplifiedNode[] = [sorted[0]];
  const firstRect = sorted[0].absRect;
  // 起点结束位置
  let currentEnd = firstRect
    ? firstRect[axis] + (axis === "x" ? firstRect.width : firstRect.height)
    : 0;
  for (let i = 1; i < sorted.length; i++) {
    const node = sorted[i];
    const rect = node.absRect;
    const start = rect ? rect[axis] : 0; // 当前遍历节点的其实位置
    const end = rect ? start + (axis === "x" ? rect.width : rect.height) : 0;
    // 判断是否相交，如果不相交则允许分行/列
    if (start > currentEnd + minGap) {
      groups.push(currentGroup);
      currentGroup = [node];
      currentEnd = end;
    } else {
      currentGroup.push(node);
      currentEnd = Math.max(currentEnd, end);
    }
  }
  groups.push(currentGroup);
  return groups;
}

// 局部分组合并
// 1.主轴距离近
// 2.
export function mergeAdjacentGroupsWithMeta(
  groups: SimplifiedNode[][],
  axis: "x" | "y"
): { group: SimplifiedNode[]; merged: boolean }[] {
  if (groups.length <= 1) {
    return groups.map(group => ({ group, merged: false }));
  }
  const result: { group: SimplifiedNode[]; merged: boolean }[] = [];
  for (const group of groups) {
    const previous = result[result.length - 1];
    if (previous && shouldMergeAdjacentGroups(previous.group, group, axis)) {
      previous.group = previous.group.concat(group);
      previous.merged = true;
    } else {
      result.push({ group, merged: false });
    }
  }
  return result;
}

// 决定是否切分行/列
export function spliteByCost(rowGroups: SimplifiedNode[][], colGroups: SimplifiedNode[][]): "row" | "column" | "none" {
  const canSplitRow = rowGroups.length > 1;
  const canSplitCol = colGroups.length > 1;

  // 2. 决策逻辑
  let bestDirection: "row" | "column" | "none" = "none";

  // 行列是否能切
  if (!canSplitRow && !canSplitCol) { 
    bestDirection = "none";
  } else if (canSplitRow && !canSplitCol) {
    bestDirection = "row";
  } else if (!canSplitRow && canSplitCol) {
    bestDirection = "column";
  } else {
    // 如果行列都能切就比较对齐成本
    const rowAlignCost = calculateAlignmentCost(rowGroups, "row");
    const colAlignCost = calculateAlignmentCost(colGroups, "column");
    const alignEpsilon = 0.05;
    if (Math.abs(rowAlignCost - colAlignCost) > alignEpsilon) {
      bestDirection = rowAlignCost <= colAlignCost ? "row" : "column";
    } else {
      // 如果对齐成本相同则比较相似成本
      const rowSimCost = calculateSimilarityCost(rowGroups);
      const colSimCost = calculateSimilarityCost(colGroups);
      bestDirection = rowSimCost < colSimCost ? "row" : "column";
    }
  }
  return bestDirection;
}
