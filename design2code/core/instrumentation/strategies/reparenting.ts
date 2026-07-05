import type { InstrumentationPacket } from "../types.js";
import {
  countBy,
  createInstrumentationPacket,
  createInstrumentationRecord,
} from "../records/packet.js";

export type NodeType = "SVG" | "TEXT" | "CONTAINER" | "IMAGE";

// 一个节点被收编为某父节点的绝对定位子节点的提交型决策。
export type ReparentAdoptionRecord = {
  childId: string;
  childName: string;
  childType: NodeType;
  parentId: string;
  parentName: string;
  fullyContained: boolean;
  overlapRatio: number;
  relativeX: number;
  relativeY: number;
};

// 一个节点因与兄弟节点重叠而被强制绝对定位的提交型决策。
export type AbsolutePositionRecord = {
  nodeId: string;
  nodeName: string;
  againstId: string;
  againstName: string;
};

// 该算法的阈值配置，由算法层在运行时注入以保持单一事实来源。
export type ReparentingConfig = {
  partlyContainThreshold: number;
  absoluteOverlapThreshold: number;
};

export interface ReparentingSummary {
  adoptedCount: number;
  fullyContainedCount: number;
  partialContainedCount: number;
  absolutePositionCount: number;
  partlyContainThreshold: number;
  absoluteOverlapThreshold: number;
}

export type ReparentingAiPacket = InstrumentationPacket<ReparentingSummary>;

export class ReparentingInstrumentationStrategy {
  private config: ReparentingConfig = { partlyContainThreshold: 0, absoluteOverlapThreshold: 0 };
  private adoptions: ReparentAdoptionRecord[] = [];
  private absolutePositions: AbsolutePositionRecord[] = [];

  // 注入算法阈值，供 summary 复用。
  configure(config: ReparentingConfig): void {
    this.config = config;
  }

  // 记录一次父子收编决策。
  recordAdoption(record: ReparentAdoptionRecord): void {
    this.adoptions.push(record);
  }

  // 记录一次兄弟重叠导致的绝对定位决策。
  recordAbsolutePosition(record: AbsolutePositionRecord): void {
    this.absolutePositions.push(record);
  }

  // 汇总累积状态并生成 packet。
  buildPacket(): ReparentingAiPacket {
    const summary: ReparentingSummary = {
      adoptedCount: this.adoptions.length,
      fullyContainedCount: countBy(this.adoptions, (item) => item.fullyContained),
      partialContainedCount: countBy(this.adoptions, (item) => !item.fullyContained),
      absolutePositionCount: this.absolutePositions.length,
      partlyContainThreshold: this.config.partlyContainThreshold,
      absoluteOverlapThreshold: this.config.absoluteOverlapThreshold,
    };
    return createInstrumentationPacket(
      "reparenting",
      "adopt overlapping nodes into best-fit parents and mark sibling overlaps as absolute",
      summary,
      [
        ...this.adoptions.map(toAdoptionRecord),
        ...this.absolutePositions.map(toAbsolutePositionRecord),
      ],
    );
  }
}

// 将收编决策转换为通用 instrumentation 记录。
function toAdoptionRecord(decision: ReparentAdoptionRecord) {
  return createInstrumentationRecord({
    strategyPoint: "reparent-adoption",
    intent: "explain why a node is adopted as an absolute child of a parent",
    recordType: "adoption-decision",
    targetId: decision.childId,
    title: decision.childName,
    fields: {
      childType: decision.childType,
      parentId: decision.parentId,
      parentName: decision.parentName,
      fullyContained: decision.fullyContained,
      overlapRatio: decision.overlapRatio,
      relativeX: decision.relativeX,
      relativeY: decision.relativeY,
    },
    payload: decision,
  });
}

// 将绝对定位决策转换为通用 instrumentation 记录。
function toAbsolutePositionRecord(decision: AbsolutePositionRecord) {
  return createInstrumentationRecord({
    strategyPoint: "absolute-position",
    intent: "explain which node is forced to absolute position due to sibling overlap",
    recordType: "absolute-position-decision",
    targetId: decision.nodeId,
    title: decision.nodeName,
    fields: {
      againstId: decision.againstId,
      againstName: decision.againstName,
    },
    payload: decision,
  });
}
