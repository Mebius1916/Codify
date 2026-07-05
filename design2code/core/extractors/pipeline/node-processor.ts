import { runReconstructionPipeline } from "./reconstruction.js";
import type {
  TraversalContext,
  SimplifiedNode,
} from "../../types/extractor-types.js";
import { processNodes } from "./utils/core-process.js";
import { flattenRedundantNodes } from "../algorithms/flattening.js";
import { normalizeNodeStyles } from "../algorithms/style-normalization.js";
import type { InstrumentationHub } from "../../instrumentation/hub.js";

/**
 * Traverse the Figma node tree and extract simplified nodes.
 *
 * This function orchestrates the traversal and delegates specific extraction
 * logic to the `processNodes` function.
 */
export function extractFromDesign(
  nodes: any[], // Raw Figma nodes
  globalVars: TraversalContext["globalVars"] = { styles: {} },
  instrumentation?: InstrumentationHub,
): { nodes: SimplifiedNode[]; globalVars: TraversalContext["globalVars"] } {

  const context: TraversalContext = {
    currentDepth: 0,
    parent: undefined,
    globalVars,
  };

  // 1. Extraction Phase (with Injected Structure Pass)
  let rootNodes = processNodes(nodes, context, (children, parent) =>
    runReconstructionPipeline(children, globalVars, parent, instrumentation),
  );

  // 2. Flattening Phase
  rootNodes = flattenRedundantNodes(rootNodes);
  
  // 3. Style Normalization Phase
  rootNodes = normalizeNodeStyles(rootNodes, globalVars);

  // 剪枝操作，减少内存占用
  if (globalVars.extraStyles) {
    delete globalVars.extraStyles;
    delete globalVars.layoutMetaById;
  }

  return {
    nodes: rootNodes,
    globalVars,
  };
}
