import type { SimplifiedNode } from "../../types/extractor-types.js";
import type { BoundingBox } from "../../types/simplified-types.js";
import { UnionFind } from "./utils/union-find.js";
import { isClusterCandidate } from "../../utils/candidate-check.js";
import { buildContainerByGap } from "./utils/layout-inference.js";
import { inferClusterDirection } from "./utils/infer-direction.js";
import type { AdjacencyClusteringInstrumentationStrategy } from "../../instrumentation/strategies/adjacency-clustering.js";

type ClusterCandidate = {
  index: number;
  node: SimplifiedNode;
};

const MAX_MAIN_AXIS_GAP_RATIO = 0.5;
const MIN_CROSS_AXIS_OVERLAP_RATIO = 0.5;
const MAX_MERGED_EMPTY_RATIO = 0.45;

// 将互相邻接的节点聚成虚拟内容组，可选记录 AI 证据。
export function groupNodesByAdjacency(
  nodes: SimplifiedNode[],
  parent?: SimplifiedNode,
  instrumentation?: AdjacencyClusteringInstrumentationStrategy,
): SimplifiedNode[] {
  instrumentation?.configure({
    maxMainAxisGapRatio: MAX_MAIN_AXIS_GAP_RATIO,
    minCrossAxisOverlapRatio: MIN_CROSS_AXIS_OVERLAP_RATIO,
    maxMergedEmptyRatio: MAX_MERGED_EMPTY_RATIO,
  });
  for (const node of nodes) {
    if (node.needsDownstreamProcessing && node.children?.length) {
      node.children = groupNodesByAdjacency(node.children, node, instrumentation);
    }
  }

  if (nodes.length < 2) return nodes;

  const candidates: ClusterCandidate[] = [];
  const others: ClusterCandidate[] = [];

  nodes.forEach((node, i) => {
    if (isClusterCandidate(node)) {
      candidates.push({ index: i, node });
    } else {
      others.push({ index: i, node });
    }
  });

  if (candidates.length < 2) return nodes;

  // 初始化一个并查集用于元素分组（只存索引）
  const uf = new UnionFind(candidates.length);

  // 用明确的方向邻接规则建边：主轴靠近、交叉轴对齐、合并后不产生过多空白。
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (areRectsAdjacent(candidates[i].node.absRect!, candidates[j].node.absRect!)) {
        uf.union(i, j);
      }
    }
  }

  const groupIndices = uf.getGroups(); // 索引集合
  const clusters = new Map<number, ClusterCandidate[]>(); // 索引对应的元素集合
  
  // 通过 idx 映射索引到具体节点
  for (const [root, indices] of groupIndices) {
    const items = indices.map(idx => candidates[idx]);
    clusters.set(root, items);
  }

  // 5. Create Virtual Groups and Maintain Order
  const finalNodesWithOrder: { index: number; node: SimplifiedNode }[] = [];

  // Add non-clustered nodes
  others.forEach(item => {
    finalNodesWithOrder.push({ index: item.index, node: item.node });
  });

  // Add clusters
  for (const [_, clusterItems] of clusters) {
    if (clusterItems.length > 1) {
      const sortedChildren = [...clusterItems]
        .sort((a, b) => a.index - b.index)
        .map((item) => item.node);

      const direction = inferClusterDirection(sortedChildren);
      const group = buildContainerByGap({
        name: "Content Group",
        idPrefix: "virtual-adjacency",
        children: sortedChildren,
        direction,
        parent,
      });
      
      // 最小索引插入
      const minIndex = Math.min(...clusterItems.map(item => item.index));

      finalNodesWithOrder.push({ index: minIndex, node: group });
      instrumentation?.recordCluster({
        groupId: group.id,
        direction,
        memberCount: sortedChildren.length,
      });
    } else {
      const item = clusterItems[0];
      finalNodesWithOrder.push({ index: item.index, node: item.node });
    }
  }

  // 按索引顺序排序，排序后剔除索引对象
  return finalNodesWithOrder.sort((a, b) => a.index - b.index).map(x => x.node);
}

function areRectsAdjacent(a: BoundingBox, b: BoundingBox): boolean {
  if (getMergedEmptyRatio(a, b) > MAX_MERGED_EMPTY_RATIO) return false;

  const horizontalOverlap = getAxisOverlap(a.x, a.width, b.x, b.width);
  const verticalOverlap = getAxisOverlap(a.y, a.height, b.y, b.height);
  if (horizontalOverlap > 0 && verticalOverlap > 0) return false;

  const horizontalGap = getAxisGap(a.x, a.width, b.x, b.width);
  const verticalGap = getAxisGap(a.y, a.height, b.y, b.height);

  const isHorizontalNeighbor =
    horizontalGap <= Math.min(a.width, b.width) * MAX_MAIN_AXIS_GAP_RATIO &&
    verticalOverlap / Math.min(a.height, b.height) >= MIN_CROSS_AXIS_OVERLAP_RATIO;

  const isVerticalNeighbor =
    verticalGap <= Math.min(a.height, b.height) * MAX_MAIN_AXIS_GAP_RATIO &&
    horizontalOverlap / Math.min(a.width, b.width) >= MIN_CROSS_AXIS_OVERLAP_RATIO;

  return isHorizontalNeighbor || isVerticalNeighbor;
}

function getMergedEmptyRatio(a: BoundingBox, b: BoundingBox): number {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  const mergedArea = (maxX - minX) * (maxY - minY);
  const occupiedArea = a.width * a.height + b.width * b.height - getIntersectionArea(a, b);
  return (mergedArea - occupiedArea) / mergedArea;
}

function getIntersectionArea(a: BoundingBox, b: BoundingBox): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function getAxisGap(startA: number, sizeA: number, startB: number, sizeB: number): number {
  return Math.max(0, Math.max(startA - (startB + sizeB), startB - (startA + sizeA)));
}

function getAxisOverlap(startA: number, sizeA: number, startB: number, sizeB: number): number {
  return Math.max(0, Math.min(startA + sizeA, startB + sizeB) - Math.max(startA, startB));
}
