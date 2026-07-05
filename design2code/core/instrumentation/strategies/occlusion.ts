import type { OpaqueOccluderRule } from "../../utils/paint-opacity.js";
import type { InstrumentationPacket } from "../types.js";
import {
  average,
  countBy,
  createInstrumentationPacket,
  createInstrumentationRecord,
} from "../records/packet.js";

export type VisibleContentRule = "leaf-node" | "visible-style" | "child-intersection" | "no-visible-content";

export type OpaqueRule = OpaqueOccluderRule;

export type FillKind = "css-color" | "single-paint" | "multi-paint" | "none" | "unresolved";

export type NodeType = "SVG" | "TEXT" | "CONTAINER" | "IMAGE";

export type VisibleContentStats = {
  hitChildCount: number;
  maxChildIntersectionAreaRatio: number;
};

export type FillStats = {
  fillKind: FillKind;
  fillColorOpaque?: boolean;
};

// 单个节点的可见性提交型决策（保留或移除）。
export type OcclusionDecisionRecord = {
  id: string;
  name: string;
  nodeType: NodeType;
  action: "remove" | "keep";
  reason: "fully-covered" | VisibleContentRule;
  remainingAreaRatio: number;
  remainingRegionCount: number;
  visibleContentRule: VisibleContentRule;
  hitChildCount: number;
  maxChildIntersectionAreaRatio: number;
  occluderInfluenceCount: number;
};

// 单个节点是否可作为不透明遮挡层的提交型决策。
export type OccluderDecisionRecord = {
  id: string;
  name: string;
  nodeType: NodeType;
  action: "add-occluder" | "reject-occluder";
  opaqueRule: OpaqueRule;
  opacity?: number;
  blendMode?: string;
  fillKind: FillKind;
  fillColorOpaque?: boolean;
  borderRadius?: string;
};

type OcclusionStrategyState = {
  inputNodeCount: number;
  outputNodeCount: number;
  skippedInvalidGeometryCount: number;
  decisions: OcclusionDecisionRecord[];
  occluderDecisions: OccluderDecisionRecord[];
};

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

export class OcclusionInstrumentationStrategy {
  private state: OcclusionStrategyState = {
    inputNodeCount: 0,
    outputNodeCount: 0,
    skippedInvalidGeometryCount: 0,
    decisions: [],
    occluderDecisions: [],
  };

  // 累加一次遮挡阶段的输入/输出节点数（pipeline 会多次递归调用）。
  recordStage(inputNodeCount: number, outputNodeCount: number): void {
    this.state.inputNodeCount += inputNodeCount;
    this.state.outputNodeCount += outputNodeCount;
  }

  // 记录因几何信息无效而跳过的节点。
  recordInvalidGeometry(): void {
    this.state.skippedInvalidGeometryCount += 1;
  }

  // 记录单个节点的可见性决策。
  recordNodeDecision(decision: OcclusionDecisionRecord): void {
    this.state.decisions.push(decision);
  }

  // 记录单个节点是否可作为遮挡层的决策。
  recordOccluderDecision(decision: OccluderDecisionRecord): void {
    this.state.occluderDecisions.push(decision);
  }

  // 汇总全部累积状态并生成 packet。
  buildPacket(): OcclusionAiPacket {
    return createInstrumentationPacket(
      "occlusion",
      "remove nodes hidden by later opaque sibling layers",
      buildSummary(this.state),
      [
        ...this.state.decisions.map(toNodeDecisionRecord),
        ...this.state.occluderDecisions.map(toOccluderDecisionRecord),
      ],
    );
  }
}

// 将节点可见性决策转换为通用 instrumentation 记录。
function toNodeDecisionRecord(decision: OcclusionDecisionRecord) {
  return createInstrumentationRecord({
    strategyPoint: "node-visibility",
    intent: "explain why a node is kept or removed after occluder subtraction",
    recordType: "node-decision",
    targetId: decision.id,
    title: decision.name,
    fields: {
      nodeType: decision.nodeType,
      action: decision.action,
      reason: decision.reason,
      remainingAreaRatio: decision.remainingAreaRatio,
      remainingRegionCount: decision.remainingRegionCount,
      visibleContentRule: decision.visibleContentRule,
      hitChildCount: decision.hitChildCount,
      maxChildIntersectionAreaRatio: decision.maxChildIntersectionAreaRatio,
      occluderInfluenceCount: decision.occluderInfluenceCount,
    },
    payload: decision,
  });
}

// 将遮挡层资格决策转换为通用 instrumentation 记录。
function toOccluderDecisionRecord(decision: OccluderDecisionRecord) {
  return createInstrumentationRecord({
    strategyPoint: "occluder-opacity",
    intent: "explain why a kept node is accepted or rejected as an opaque occluder",
    recordType: "occluder-decision",
    targetId: decision.id,
    title: decision.name,
    fields: {
      nodeType: decision.nodeType,
      action: decision.action,
      opaqueRule: decision.opaqueRule,
      opacity: decision.opacity ?? null,
      blendMode: decision.blendMode ?? null,
      fillKind: decision.fillKind,
      fillColorOpaque: decision.fillColorOpaque ?? null,
      borderRadius: decision.borderRadius ?? null,
    },
    payload: decision,
  });
}

// 汇总遮挡阶段的数量和面积统计。
function buildSummary(state: OcclusionStrategyState): OcclusionStageSummary {
  const remainingRatios = state.decisions.map((item) => item.remainingAreaRatio);
  const regionCounts = state.decisions.map((item) => item.remainingRegionCount);
  const countDecision = (action: OcclusionDecisionRecord["action"], reason?: OcclusionDecisionRecord["reason"]) =>
    countBy(state.decisions, (item) => item.action === action && (!reason || item.reason === reason));
  const countOccluder = (action: OccluderDecisionRecord["action"]) =>
    countBy(state.occluderDecisions, (item) => item.action === action);

  return {
    inputNodeCount: state.inputNodeCount,
    outputNodeCount: state.outputNodeCount,
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
