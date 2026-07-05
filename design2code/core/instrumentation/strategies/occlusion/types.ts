import type { SimplifiedNode, TraversalContext } from "../../../types/extractor-types.js";
import type { BoundingBox } from "../../../types/simplified-types.js";
import type { InstrumentationPacket } from "../../types.js";

export interface OcclusionNodeEvaluationInput {
  node: SimplifiedNode;
  rect: BoundingBox;
  remainingRegions: BoundingBox[];
  occluderRects: BoundingBox[];
  isOccluded: boolean;
}

export interface OcclusionOccluderEvaluationInput {
  node: SimplifiedNode;
  rect: BoundingBox;
  globalVars?: TraversalContext["globalVars"];
  isOpaque: boolean;
}

export interface OcclusionStageSummary {
  inputNodeCount: number;
  outputNodeCount: number;
  removedNodeCount: number;
  occluderCount: number;
  skippedInvalidGeometryCount: number;
  decisionCounts: {
    removedFullyCovered: number;
    removedNoVisibleContent: number;
    keptLeaf: number;
    keptByVisibleStyle: number;
    keptByChildIntersection: number;
    addedAsOccluder: number;
    rejectedAsOccluder: number;
  };
  areaStats: {
    averageRemainingAreaRatio: number;
    minRemainingAreaRatio: number;
    maxRemainingRegionCount: number;
  };
}

export type OcclusionAiPacket = InstrumentationPacket<OcclusionStageSummary>;
