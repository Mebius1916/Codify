import type { SimplifiedNode } from "../../../types/extractor-types.js";
import type { BoundingBox } from "../../../types/simplified-types.js";
import type { OcclusionAiPacket } from "./types.js";

export type VisibleContentRule = "leaf-node" | "visible-style" | "child-intersection" | "no-visible-content";

export type OpaqueRule =
  | "accept-single-opaque-solid-rectangle"
  | "reject-text-or-svg"
  | "reject-opacity-less-than-1"
  | "reject-non-normal-blend-mode"
  | "reject-image"
  | "reject-not-single-opaque-solid-fill"
  | "reject-border-radius";

export type FillKind = "css-color" | "single-paint" | "multi-paint" | "none" | "unresolved";

export type NodeBrief = {
  id: string;
  name: string;
  type: SimplifiedNode["type"];
  rect?: BoundingBox;
  hasVisibleStyle: boolean;
};

export type VisibleContentDecision = {
  result: boolean;
  rule: VisibleContentRule;
  checkedChildCount: number;
  hitChildCount: number;
  maxChildIntersectionAreaRatio: number;
};

export type OpaqueDecision = {
  result: boolean;
  rule: OpaqueRule;
  checks: {
    nodeType: SimplifiedNode["type"];
    opacity?: number;
    blendMode?: string;
    fillKind: FillKind;
    fillColorOpaque?: boolean;
    borderRadius?: string;
  };
};

export type OcclusionDecisionRecord = {
  node: NodeBrief;
  action: "remove" | "keep";
  reason: "fully-covered" | VisibleContentRule;
  geometry: {
    originalArea: number;
    remainingArea: number;
    remainingAreaRatio: number;
    remainingRegionCount: number;
    largestRemainingRegionRatio: number;
  };
  visibleContentDecision: VisibleContentDecision;
  occluderInfluence: Array<{
    node: NodeBrief;
    overlapArea: number;
    overlapRatioOfNode: number;
    opaqueRule: OpaqueRule;
  }>;
};

export type OccluderDecisionRecord = {
  node: NodeBrief;
  action: "add-occluder" | "reject-occluder";
  opaqueDecision: OpaqueDecision;
};

export type AcceptedOccluderRecord = {
  node: SimplifiedNode;
  rect: BoundingBox;
  opaqueDecision: OpaqueDecision;
};

export type OcclusionStrategyState = {
  inputNodeCount: number;
  skippedInvalidGeometryCount: number;
  decisions: OcclusionDecisionRecord[];
  occluderDecisions: OccluderDecisionRecord[];
  acceptedOccluders: AcceptedOccluderRecord[];
  latestPacket: OcclusionAiPacket | null;
};
