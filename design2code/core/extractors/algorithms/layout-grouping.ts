
import type { SimplifiedNode } from "../../types/extractor-types.js";
import { buildContainerByGap } from "./utils/layout-inference.js";
import {
  mergeAdjacentGroupsWithMeta,
  splitByProjection,
  spliteByCost
} from "./utils/group-calculation.js";

const MIN_LAYOUT_GAP = 2;

export function groupNodesByLayout(nodes: SimplifiedNode[], parent?: SimplifiedNode): SimplifiedNode[] {
  for (const node of nodes) {
    if (node.needsDownstreamProcessing && node.children?.length) {
      node.children = groupNodesByLayout(node.children, node);
    }
  }

  // 排除绝对定位的节点
  const flowNodes: SimplifiedNode[] = [];
  const absoluteNodes: SimplifiedNode[] = [];
  for (const node of nodes) {
    if (typeof node.layout === "object" && node.layout?.position === "absolute") {
      absoluteNodes.push(node);
    } else {
      flowNodes.push(node);
    }
  }

  if (flowNodes.length <= 1) {
    return [...flowNodes, ...absoluteNodes];
  }

  // 父节点已经有明确的 AutoLayout 语义时，保留原始 children 顺序，
  // 不再用几何分组结果覆盖父级的主轴方向。
  if (parent && typeof parent.layout === "object" && parent.layout) {
    const parentMode = parent.layout.mode;
    if (parentMode === "row" || parentMode === "column") {
      return [...flowNodes, ...absoluteNodes];
    }
  }

  // 先全局投影切片
  const spliteY = splitByProjection(flowNodes, "y", MIN_LAYOUT_GAP);
  const spliteX = splitByProjection(flowNodes, "x", MIN_LAYOUT_GAP);

  // 后局部相邻合并
  const rowGroupMeta = mergeAdjacentGroupsWithMeta(spliteY, "y");
  const colGroupMeta = mergeAdjacentGroupsWithMeta(spliteX, "x");

  const rowGroups = rowGroupMeta.map(item => item.group);
  const colGroups = colGroupMeta.map(item => item.group);
  
  const bestDirection = spliteByCost(rowGroups, colGroups);

  // 根据决策结果处理
  if (bestDirection === "row") {
    const processedRows = rowGroupMeta.map((meta) => buildGroup(meta.group, "row", parent));
    return [...processedRows, ...absoluteNodes];
  } else if (bestDirection === "column") {
    const processedCols = colGroupMeta.map((meta) => buildGroup(meta.group, "column", parent));
    return [...processedCols, ...absoluteNodes];
  }

  return [...flowNodes, ...absoluteNodes];
}

function buildGroup(group: SimplifiedNode[], direction: "row" | "column", parent?: SimplifiedNode): SimplifiedNode {
  return buildContainerByGap({
    name: "Group",
    idPrefix: "virtual-layout-grouping",
    children: group,
    direction,
    allowSingle: true,
    parent,
  });
}
