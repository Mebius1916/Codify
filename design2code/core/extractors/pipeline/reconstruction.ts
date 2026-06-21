import { removeOccludedNodes } from "../algorithms/occlusion.js";
import { reparentNodes } from "../algorithms/reparenting.js";
import { mergeSpatialIcons } from "../algorithms/spatial-merging.js";
import { groupNodesByLayout } from "../algorithms/layout-grouping.js";
import { groupNodesByAdjacency } from "../algorithms/adjacency-clustering.js";
import { inferSemanticTags } from "../algorithms/semantic-inference.js";
import type { SimplifiedNode, TraversalContext } from "../../types/extractor-types.js";
import { SimplifiedLayout } from "../../types/simplified-types.js";

/**
 * Structure + Layout Pipeline
 * 流水线开关功能已移除，默认执行所有核心步骤
 */
export function runReconstructionPipeline(
  nodes: SimplifiedNode[],
  globalVars?: TraversalContext["globalVars"],
  _options?: any, // 保留参数签名以减少其他文件的改动量，但不再使用
  parent?: SimplifiedNode
): SimplifiedNode[] {
  if (nodes.length === 0) return [];

  // 0. Pre-processing: Reverse order from Figma (Top->Bottom) to HTML (Bottom->Top)
  const processedNodesInput = [...nodes];

  // 1. Occlusion Culling
  let processedNodes = removeOccludedNodes(processedNodesInput, globalVars);

  // 2. Reparenting 
  processedNodes = reparentNodes(processedNodes, parent);

  // 3. Merge fragmented icon leaves before broader layout grouping.
  processedNodes = mergeSpatialIcons(processedNodes, parent);

  const parentLayout = parent?.layout as SimplifiedLayout | undefined;
  
  if (parentLayout?.mode !== "row" &&
      parentLayout?.mode !== "column") {
      // 4. Layout Grouping 
      processedNodes = groupNodesByLayout(processedNodes, parent);
      // 5. Adjacency Clustering
      processedNodes = groupNodesByAdjacency(processedNodes, parent);
  }

  // 6. Semantic Inference
  processedNodes = inferSemanticTags(processedNodes);

  return processedNodes;
}
