import type { SimplifiedNode } from "../../types/extractor-types.js";
import type { BoundingBox, SimplifiedLayout } from "../../types/simplified-types.js";
import { createVirtualFrame } from "./utils/virtual-node.js";
import { areRectsTouching, getUnionRect, calculateRelativePosition } from "../../utils/geometry.js";
import { UnionFind } from "./utils/union-find.js";
import { isMergeCandidate } from "../../utils/candidate-check.js";
import type { SpatialMergingInstrumentationStrategy } from "../../instrumentation/strategies/spatial-merging.js";

type IconPart = {
  index: number;
  rect: BoundingBox;
  node: SimplifiedNode;
};

const ICON_CLUSTER_RULES = {
  maxClusterSize: 80,
  maxPartGap: 4,
  repeatedSequenceTolerance: 2,
} as const;

// 将相邻的碎片图标合并成单个虚拟图标节点，可选记录 AI 证据。
export function mergeSpatialIcons(
  nodes: SimplifiedNode[],
  parent?: SimplifiedNode,
  instrumentation?: SpatialMergingInstrumentationStrategy,
): SimplifiedNode[] {
  instrumentation?.configure(ICON_CLUSTER_RULES);
  for (const node of nodes) {
    if (node.needsDownstreamProcessing && node.children?.length) {
      node.children = mergeSpatialIcons(node.children, node, instrumentation);
    }
  }

  if (nodes.length < 2) return nodes;

  const candidates: IconPart[] = [];
  const nonCandidates: { index: number; node: SimplifiedNode }[] = [];

  // 1. Filter candidates
  nodes.forEach((node, i) => {
    if (isMergeCandidate(node, ICON_CLUSTER_RULES.maxClusterSize)) {
      candidates.push({ index: i, rect: node.absRect!, node });
    } else {
      nonCandidates.push({ index: i, node });
    }
  });

  if (candidates.length < 2) return nodes;

  // 2. Clustering using Union-Find
  const uf = new UnionFind(candidates.length);
  const mergeDistance = ICON_CLUSTER_RULES.maxPartGap;

  // 并查集将符合条件的碎片合并到一个集合中
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (areRectsTouching(candidates[i].rect, candidates[j].rect, mergeDistance)) {
        uf.union(i, j);
      }
    }
  }

  // 3. Group by cluster
  const groupIndices = uf.getGroups();
  const clusters = new Map<number, typeof candidates>();

  // 并查集存储的是 id，所以这里需要根据 id 找到对应的碎片
  for (const [root, indices] of groupIndices) {
    const parts = indices.map(idx => candidates[idx]);
    clusters.set(root, parts);
  }

  // 4. 恢复节点列表原始排序（不合法节点保持原位置）
  const finalNodes = [...nonCandidates.map(nc => ({ node: nc.node, sortIdx: nc.index }))];
  
  for (const [_, clusterParts] of clusters) {
    const rejectReason = getClusterRejectReason(clusterParts, ICON_CLUSTER_RULES.maxClusterSize);
    if (!rejectReason) {
      // 小图标合并后的虚拟节点
      const mergedNode = createMergedIconNode(clusterParts.map(c => c.node), parent);
      // 插入位置选择最早出现的碎片index
      const minIdx = Math.min(...clusterParts.map(c => c.index));
      finalNodes.push({ node: mergedNode, sortIdx: minIdx });
      const layout = mergedNode.layout as SimplifiedLayout | undefined;
      instrumentation?.recordMerge({
        mergedId: mergedNode.id,
        partCount: clusterParts.length,
        unionWidth: mergedNode.absRect?.width ?? 0,
        unionHeight: mergedNode.absRect?.height ?? 0,
        position: layout?.position ?? "static",
      });
    } else {
      if (clusterParts.length >= 2) instrumentation?.recordReject(rejectReason);
      for (const part of clusterParts) {
        finalNodes.push({ node: part.node, sortIdx: part.index });
      }
    }
  }

  return finalNodes.sort((a, b) => a.sortIdx - b.sortIdx).map(n => n.node);
}

// 计算所有碎片的总包围矩形
function createMergedIconNode(parts: SimplifiedNode[], parent?: SimplifiedNode): SimplifiedNode {
  // 检查是否所有子节点都是绝对定位
  const allAbsolute = parts.every(p => {
    const layout = p.layout;
    return typeof layout === "object" && layout && layout.position === "absolute";
  });

  const parentLayout = parent?.layout;
  const isParentAutoLayout =
    typeof parentLayout === "object" && (parentLayout?.mode === "row" || parentLayout?.mode === "column");
  
  // Flow icons still need a positioned containing block for absolute SVG parts.
  const position = (allAbsolute || !isParentAutoLayout) ? "absolute" : "relative";

  const layout: SimplifiedLayout = {
    mode: "none",
    sizing: {},
    position: position,
  };

  const unionRect = getUnionRect(parts.map((p) => p.absRect).filter(Boolean) as BoundingBox[]);
  if (unionRect.width > 0 && unionRect.height > 0) {
    layout.dimensions = {
      width: unionRect.width,
      height: unionRect.height,
    };
  }
  
  // 如果是绝对定位，必须计算相对坐标
  if (position === "absolute" && parent?.absRect && unionRect) {
    layout.locationRelativeToParent = 
      calculateRelativePosition(unionRect, parent.absRect);
  }

  const node = createVirtualFrame({
    idPrefix: "virtual-spatial-merge",
    name: "Merged Icon",
    type: "CONTAINER",
    layout: layout,
    semanticTag: "icon",
    needsDownstreamProcessing: false,
    children: parts,
  });

  if (node.absRect) {
    for (const part of parts) {
      if (!part.absRect) continue;
      const partLayout =
        typeof part.layout === "object" && part.layout
          ? part.layout
          : { mode: "none" as const, sizing: {} };
      part.layout = {
        ...partLayout,
        position: "absolute",
        parentMode: "none",
        locationRelativeToParent: calculateRelativePosition(part.absRect, node.absRect),
      };
    }
  }

  return node;
}

// 判断候选簇是否应被拒绝合并，返回拒绝原因或 null（可合并）。
function getClusterRejectReason(parts: IconPart[], maxSize: number): "too-large" | "repeated-sequence" | null {
  if (parts.length < 2) return "too-large";

  const rects = parts.map((part) => part.rect);
  const unionRect = getUnionRect(rects);
  if (unionRect.width === 0 || unionRect.height === 0) return "too-large";
  if (unionRect.width > maxSize || unionRect.height > maxSize) return "too-large";

  if (looksLikeRepeatedIconSequence(rects)) return "repeated-sequence";

  return null;
}

function looksLikeRepeatedIconSequence(rects: BoundingBox[]): boolean {
  if (rects.length < 3) return false;
  const unionRect = getUnionRect(rects);
  let direction: "x" | "y" | null = null;
  if (unionRect.width >= unionRect.height * 1.8) {
    direction = "x";
  } else if (unionRect.height >= unionRect.width * 1.8) {
    direction = "y";
  }
  if (!direction) return false;

  const sorted = [...rects].sort((a, b) => a[direction] - b[direction]);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1];
    const current = sorted[i];
    const previousEnd = previous[direction] + (direction === "x" ? previous.width : previous.height);
    gaps.push(Math.max(0, current[direction] - previousEnd));
  }

  const positiveGaps = gaps.filter((gap) => gap > 0);
  if (positiveGaps.length !== gaps.length) return false;

  const minGap = Math.min(...positiveGaps);
  const maxGap = Math.max(...positiveGaps);
  if (maxGap - minGap > ICON_CLUSTER_RULES.repeatedSequenceTolerance) return false;

  const sizes = sorted.map((rect) => direction === "x" ? rect.width : rect.height);
  return Math.max(...sizes) - Math.min(...sizes) <= ICON_CLUSTER_RULES.repeatedSequenceTolerance;
}
