import type {
  OccluderDecisionRecord,
  OcclusionDecisionRecord,
  OcclusionStrategyState,
} from "./model.js";
import type {
  OcclusionAiPacket,
  OcclusionStageSummary,
} from "./types.js";

export function createOcclusionPacket(
  state: OcclusionStrategyState,
  outputNodeCount: number,
): OcclusionAiPacket {
  const summary = buildSummary(state, outputNodeCount);
  return {
    strategyId: "occlusion",
    intent: "remove nodes hidden by later opaque sibling layers",
    summary,
    records: [
      ...state.decisions.map(toNodeDecisionRecord),
      ...state.occluderDecisions.map(toOccluderDecisionRecord),
    ],
  };
}

function toNodeDecisionRecord(decision: OcclusionDecisionRecord) {
  return {
    strategyPoint: "node-visibility",
    intent: "explain why a node is kept or removed after occluder subtraction",
    recordType: "node-decision",
    targetId: decision.node.id,
    title: decision.node.name,
    fields: {
      nodeType: decision.node.type,
      action: decision.action,
      reason: decision.reason,
      remainingAreaRatio: decision.geometry.remainingAreaRatio,
      remainingRegionCount: decision.geometry.remainingRegionCount,
      visibleContentRule: decision.visibleContentDecision.rule,
      hitChildCount: decision.visibleContentDecision.hitChildCount,
      maxChildIntersectionAreaRatio: decision.visibleContentDecision.maxChildIntersectionAreaRatio,
      occluderInfluenceCount: decision.occluderInfluence.length,
    },
    payload: decision,
  };
}

function toOccluderDecisionRecord(decision: OccluderDecisionRecord) {
  return {
    strategyPoint: "occluder-opacity",
    intent: "explain why a kept node is accepted or rejected as an opaque occluder",
    recordType: "occluder-decision",
    targetId: decision.node.id,
    title: decision.node.name,
    fields: {
      nodeType: decision.node.type,
      action: decision.action,
      opaqueRule: decision.opaqueDecision.rule,
      opacity: decision.opaqueDecision.checks.opacity ?? null,
      blendMode: decision.opaqueDecision.checks.blendMode ?? null,
      fillKind: decision.opaqueDecision.checks.fillKind,
      fillColorOpaque: decision.opaqueDecision.checks.fillColorOpaque ?? null,
      borderRadius: decision.opaqueDecision.checks.borderRadius ?? null,
    },
    payload: decision,
  };
}

function buildSummary(state: OcclusionStrategyState, outputNodeCount: number): OcclusionStageSummary {
  const remainingRatios = state.decisions.map((item) => item.geometry.remainingAreaRatio);
  const regionCounts = state.decisions.map((item) => item.geometry.remainingRegionCount);
  const countDecision = (action: OcclusionDecisionRecord["action"], reason?: OcclusionDecisionRecord["reason"]) =>
    state.decisions.filter((item) => item.action === action && (!reason || item.reason === reason)).length;
  const countOccluder = (action: OccluderDecisionRecord["action"]) =>
    state.occluderDecisions.filter((item) => item.action === action).length;

  return {
    inputNodeCount: state.inputNodeCount,
    outputNodeCount,
    removedNodeCount: countDecision("remove"),
    occluderCount: countOccluder("add-occluder"),
    skippedInvalidGeometryCount: state.skippedInvalidGeometryCount,
    decisionCounts: {
      removedFullyCovered: countDecision("remove", "fully-covered"),
      removedNoVisibleContent: countDecision("remove", "no-visible-content"),
      keptLeaf: countDecision("keep", "leaf-node"),
      keptByVisibleStyle: countDecision("keep", "visible-style"),
      keptByChildIntersection: countDecision("keep", "child-intersection"),
      addedAsOccluder: countOccluder("add-occluder"),
      rejectedAsOccluder: countOccluder("reject-occluder"),
    },
    areaStats: {
      averageRemainingAreaRatio: average(remainingRatios),
      minRemainingAreaRatio: remainingRatios.length > 0 ? Math.min(...remainingRatios) : 0,
      maxRemainingRegionCount: regionCounts.length > 0 ? Math.max(...regionCounts) : 0,
    },
  };
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
