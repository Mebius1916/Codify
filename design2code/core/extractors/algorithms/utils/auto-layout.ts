
import type { SimplifiedNode } from "../../../types/extractor-types.js";
import { getNodeBoundingBox, getUnionRect } from "../../../utils/geometry.js";

const GAP_TOLERANCE = 2;

export function isAutoLayoutNode(node: SimplifiedNode): boolean {
  const layout = (node as any).layout;
  return (
    typeof layout === "object" &&
    !!layout &&
    "mode" in layout &&
    ((layout as any).mode === "row" || (layout as any).mode === "column")
  );
}

// 计算行/列相邻节点的间距
export function computeAutoLayoutGap(
  children: SimplifiedNode[],
  direction: "row" | "column"
): { gap: number; uniform: boolean } {
  if (!children || children.length < 2) return { gap: 0, uniform: true };
  const axis = direction === "row" ? "x" : "y";
  const sizeKey = direction === "row" ? "width" : "height";
  const sorted = [...children].sort((a, b) => {
    const rectA = getNodeBoundingBox(a);
    const rectB = getNodeBoundingBox(b);
    const startA = rectA ? rectA[axis] : 0;
    const startB = rectB ? rectB[axis] : 0;
    return startA - startB;
  });

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prevRect = getNodeBoundingBox(sorted[i - 1]);
    const currRect = getNodeBoundingBox(sorted[i]);
    if (!prevRect || !currRect) continue;
    const prevEnd = prevRect[axis] + (prevRect as any)[sizeKey];
    const gap = currRect[axis] - prevEnd;
    gaps.push(gap > 0 ? gap : 0);
  }

  if (gaps.length === 0) return { gap: 0, uniform: true };
  const gap = getMedian(gaps);
  const uniform = gaps.every((g) => Math.abs(g - gap) <= GAP_TOLERANCE);
  return { gap, uniform };
}

function getMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// 
export function inferAutoLayoutAlignment(
  children: SimplifiedNode[],
  direction: "row" | "column",
  parent?: SimplifiedNode
): { alignItems: string; justifyContent: string } {
  if (!children || children.length === 0) {
    return { alignItems: "flex-start", justifyContent: "flex-start" };
  }

  const rects = children.map(getNodeBoundingBox).filter((r): r is NonNullable<typeof r> => !!r);
  if (rects.length === 0) {
    return { alignItems: "flex-start", justifyContent: "flex-start" };
  }

  // 计算整体包围盒
  const unionRect = getUnionRect(rects);
  const unionWidth = unionRect.width;
  const unionHeight = unionRect.height;
  const minX = unionRect.x;
  const minY = unionRect.y;

  // 1. 推断 alignItems (交叉轴对齐)
  // row: 交叉轴是 Y (height); column: 交叉轴是 X (width)
  const crossAxis = direction === "row" ? "y" : "x";
  const crossSize = direction === "row" ? "height" : "width";
  const unionStart = direction === "row" ? minY : minX;
  const unionSize = direction === "row" ? unionHeight : unionWidth;

  let alignStartCount = 0;
  let alignEndCount = 0;
  let alignCenterCount = 0;
  let alignStretchCount = 0;
  const epsilon = 2; // 容差

  for (const r of rects) {
    const start = r[crossAxis];
    const size = r[crossSize];
    const center = start + size / 2;
    const unionCenter = unionStart + unionSize / 2;

    // 检查 stretch (接近填满)
    if (Math.abs(size - unionSize) <= epsilon) {
      alignStretchCount++;
    }
    // 检查 center (中线对齐)
    if (Math.abs(center - unionCenter) <= epsilon) {
      alignCenterCount++;
    }
    // 检查 start (贴左/上)
    if (Math.abs(start - unionStart) <= epsilon) {
      alignStartCount++;
    }
    // 检查 end (贴右/下)
    if (Math.abs(start + size - (unionStart + unionSize)) <= epsilon) {
      alignEndCount++;
    }
  }

  let alignItems = "flex-start"; 
  let justifyContent = "flex-start";

  const scores = [
    { type: "stretch", count: alignStretchCount },
    { type: "center", count: alignCenterCount },
    { type: "flex-start", count: alignStartCount },
    { type: "flex-end", count: alignEndCount },
  ];

  scores.sort((a, b) => b.count - a.count); // 降序排列

  // 取第一名
  const winner = scores[0];
  if (winner.count > 0) {
    alignItems = winner.type;
  }

  // 2. 推断 justifyContent (主轴对齐)
  if (direction === "row" && children.length === 2 && parent) {
    const left = children[0];
    const right = children[1];

    // 如果左边的元素贴左，右边的元素贴右，且中间有明显空隙，大概率是 space-between
    const leftRect = getNodeBoundingBox(left);
    const rightRect = getNodeBoundingBox(right);
    const parentRect = getNodeBoundingBox(parent);

    if (leftRect && rightRect && parentRect) {
       // Check if left element is close to parent's left edge
       const isLeftAligned = Math.abs(leftRect.x - parentRect.x) <= 2;
       // Check if right element is close to parent's right edge
       const isRightAligned = Math.abs((rightRect.x + rightRect.width) - (parentRect.x + parentRect.width)) <= 2;

       if (isLeftAligned && isRightAligned) {
         justifyContent = "space-between";
       }
    }
  }
  
  return { alignItems, justifyContent };
}
