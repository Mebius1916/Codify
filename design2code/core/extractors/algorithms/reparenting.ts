/**
 * Reparenting Algorithm (Strict Layer-Based Recursive)
 */

import type { SimplifiedNode } from "../../types/extractor-types.js";
import { getRectArea, isRectContained, areRectsTouching, calculateRelativePosition } from "../../utils/geometry.js";
import { canBeParent } from "../../utils/candidate-check.js";
import type { SimplifiedLayout } from "../../types/simplified-types.js";
import type { ReparentingInstrumentationStrategy } from "../../instrumentation/strategies/reparenting.js";

type ParentCandidate = {
  parent: SimplifiedNode;
  fullyContained: boolean;
  overlapRatio: number;
  parentArea: number;
};

const PARTLY_CONTAIN_THRESHOLD = 0.85;
const ABSOLUTE_OVERLAP_THRESHOLD = -2;

// 将重叠节点收编进最合适的父节点，并把兄弟重叠标记为绝对定位，可选记录 AI 证据。
export function reparentNodes(
  nodes: SimplifiedNode[],
  parent?: SimplifiedNode,
  instrumentation?: ReparentingInstrumentationStrategy,
): SimplifiedNode[] {
  if (nodes.length === 0) return [];
  instrumentation?.configure({
    partlyContainThreshold: PARTLY_CONTAIN_THRESHOLD,
    absoluteOverlapThreshold: ABSOLUTE_OVERLAP_THRESHOLD,
  });
  for (const node of nodes) {
    if (node.needsDownstreamProcessing && node.children?.length) {
      node.children = reparentNodes(node.children, node, instrumentation);
    }
  }

  const adoptedNodes = new Set<SimplifiedNode>();

  for (let childIndex = 0; childIndex < nodes.length; childIndex++) {
    const child = nodes[childIndex];
    if (!child.absRect) continue;

    let bestCandidate: ParentCandidate | null = null;
    for (let parentIndex = 0; parentIndex < childIndex; parentIndex++) {
      const candidateParent = nodes[parentIndex];
      const candidate = getParentCandidate(
        candidateParent,
        child,
        PARTLY_CONTAIN_THRESHOLD
      );
      if (!candidate) continue;
      if (!bestCandidate || isBetterParentCandidate(candidate, bestCandidate)) {
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      adoptAsAbsoluteChild(bestCandidate.parent, child);
      adoptedNodes.add(child);
      const location = calculateRelativePosition(child.absRect, bestCandidate.parent.absRect!);
      instrumentation?.recordAdoption({
        childId: child.id,
        childName: child.name,
        childType: child.type,
        parentId: bestCandidate.parent.id,
        parentName: bestCandidate.parent.name,
        fullyContained: bestCandidate.fullyContained,
        overlapRatio: bestCandidate.overlapRatio,
        relativeX: location.x,
        relativeY: location.y,
      });
    }
  }

  // 用于存储处理后的新子节点列表 (未被吃掉的节点)
  const remainingNodes = nodes.filter(node => !adoptedNodes.has(node));
  detectAbsoluteChildrenInList(remainingNodes, parent, instrumentation);

  return remainingNodes;
}

// 是否有资格成为父节点
function getParentCandidate(
  parent: SimplifiedNode,
  child: SimplifiedNode,
  partlyContainThreshold: number
): ParentCandidate | null {
  if (!canBeParent(parent) || !parent.absRect || !child.absRect) return null;

  const parentArea = getRectArea(parent.absRect);
  const childArea = getRectArea(child.absRect);
  if (parentArea < childArea || childArea <= 0) return null;

  const fullyContained = isRectContained(parent.absRect, child.absRect);
  const overlapRatio = fullyContained ? 1 : getOverlapRatio(parent.absRect, child.absRect);
  if (!fullyContained && overlapRatio < partlyContainThreshold) return null;

  return {
    parent,
    fullyContained,
    overlapRatio,
    parentArea,
  };
}

// 选择最匹配的父节点
function isBetterParentCandidate(candidate: ParentCandidate, currentBest: ParentCandidate): boolean {
  if (candidate.fullyContained !== currentBest.fullyContained) {
    return candidate.fullyContained;
  }
  if (candidate.parentArea !== currentBest.parentArea) {
    return candidate.parentArea < currentBest.parentArea;
  }
  if (candidate.overlapRatio !== currentBest.overlapRatio) {
    return candidate.overlapRatio > currentBest.overlapRatio;
  }
  return false;
}

// AABB 碰撞检测，用于选出绝对定位的节点
function detectAbsoluteChildrenInList(
  nodes: SimplifiedNode[],
  parent?: SimplifiedNode,
  instrumentation?: ReparentingInstrumentationStrategy,
) {
  if (nodes.length < 2) return;

  // Align with FigmaToCode: If parent is Auto Layout, respect native layout.
  if (parent && typeof parent.layout === "object" && parent.layout && parent.layout.mode !== "none") {
    return;
  }

  for (let i = 0; i < nodes.length; i++) {
    const nodeA = nodes[i];
    if (!nodeA.absRect) continue;

    for (let j = i + 1; j < nodes.length; j++) {
      const nodeB = nodes[j];
      if (!nodeB.absRect) continue;

      // 是否相交
      if (!areRectsTouching(nodeA.absRect, nodeB.absRect, ABSOLUTE_OVERLAP_THRESHOLD)) continue;

      // 确定是相交关系
      if (getRectArea(nodeA.absRect) < getRectArea(nodeB.absRect)) {
        const baseLayout: SimplifiedLayout =
          typeof nodeA.layout === "object" && nodeA.layout ? nodeA.layout : { mode: "none", sizing: {} };
        nodeA.layout = {
          ...baseLayout,
          mode: "none",
          position: "absolute",
        };
        // 补充坐标计算
        if (parent?.absRect && nodeA.absRect) {
          const resolvedLayout = nodeA.layout as SimplifiedLayout;
          resolvedLayout.locationRelativeToParent =  
            calculateRelativePosition(nodeA.absRect, parent.absRect);
        }
        instrumentation?.recordAbsolutePosition({
          nodeId: nodeA.id,
          nodeName: nodeA.name,
          againstId: nodeB.id,
          againstName: nodeB.name,
        });
      } else {
        const baseLayout: SimplifiedLayout =
          typeof nodeB.layout === "object" && nodeB.layout ? nodeB.layout : { mode: "none", sizing: {} };
        nodeB.layout = {
          ...baseLayout,
          mode: "none",
          position: "absolute",
        };
        // 补充坐标计算
        if (parent?.absRect && nodeB.absRect) {
          const resolvedLayout = nodeB.layout as SimplifiedLayout;
          resolvedLayout.locationRelativeToParent = 
            calculateRelativePosition(nodeB.absRect, parent.absRect);
        }
        instrumentation?.recordAbsolutePosition({
          nodeId: nodeB.id,
          nodeName: nodeB.name,
          againstId: nodeA.id,
          againstName: nodeA.name,
        });
      }
    }
  }
}

// 将 child 追加进 parent.children，并把 child 转成相对 parent 的绝对定位
function adoptAsAbsoluteChild(parent: SimplifiedNode, child: SimplifiedNode) {
  if (!parent.absRect || !child.absRect) return;
  if (!parent.children) parent.children = [];
  parent.children.push(child);
  const parentBaseLayout: SimplifiedLayout =
    typeof parent.layout === "object" && parent.layout ? parent.layout : { mode: "none", sizing: {} };
  parent.layout = {
    ...parentBaseLayout,
    position: parentBaseLayout.position,
  };
  parent.needsDownstreamProcessing = true;
  const childBaseLayout: SimplifiedLayout =
    typeof child.layout === "object" && child.layout ? child.layout : { mode: "none", sizing: {} };
  child.layout = {
    ...childBaseLayout,
    position: "absolute",
    parentMode: "none",
    locationRelativeToParent: 
      calculateRelativePosition(child.absRect, parent.absRect),
  };
}

// 返回 b 的面积中有多少比例与 a 发生重叠（intersectionArea / bArea）
function getOverlapRatio(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number {
  const ix1 = Math.max(a.x, b.x);
  const iy1 = Math.max(a.y, b.y);
  const ix2 = Math.min(a.x + a.width, b.x + b.width);
  const iy2 = Math.min(a.y + a.height, b.y + b.height);
  const iw = ix2 - ix1;
  const ih = iy2 - iy1;
  if (iw <= 0 || ih <= 0) return 0;
  const intersectionArea = iw * ih;
  const bArea = b.width * b.height;
  if (bArea <= 0) return 0;
  return intersectionArea / bArea;
}
