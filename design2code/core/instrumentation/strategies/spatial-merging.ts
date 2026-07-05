import type { InstrumentationPacket } from "../types.js";
import {
  countBy,
  createInstrumentationPacket,
  createInstrumentationRecord,
} from "../records/packet.js";

// 一次碎片图标被合并为虚拟图标节点的提交型决策。
export type IconMergeRecord = {
  mergedId: string;
  partCount: number;
  unionWidth: number;
  unionHeight: number;
  position: string;
};

// 一次候选簇未通过校验而被拒绝合并的原因。
export type IconRejectReason = "too-large" | "repeated-sequence";

// 该算法的阈值配置，由算法层注入以保持单一事实来源。
export type SpatialMergingConfig = {
  maxClusterSize: number;
  maxPartGap: number;
  repeatedSequenceTolerance: number;
};

export interface SpatialMergingSummary {
  mergedClusterCount: number;
  mergedPartCount: number;
  rejectedTooLargeCount: number;
  rejectedRepeatedSequenceCount: number;
  maxClusterSize: number;
  maxPartGap: number;
  repeatedSequenceTolerance: number;
}

export type SpatialMergingAiPacket = InstrumentationPacket<SpatialMergingSummary>;

export class SpatialMergingInstrumentationStrategy {
  private config: SpatialMergingConfig = { maxClusterSize: 0, maxPartGap: 0, repeatedSequenceTolerance: 0 };
  private merges: IconMergeRecord[] = [];
  private rejects: IconRejectReason[] = [];

  // 注入算法阈值，供 summary 复用。
  configure(config: SpatialMergingConfig): void {
    this.config = config;
  }

  // 记录一次成功的图标合并。
  recordMerge(record: IconMergeRecord): void {
    this.merges.push(record);
  }

  // 记录一次候选簇被拒绝合并的原因。
  recordReject(reason: IconRejectReason): void {
    this.rejects.push(reason);
  }

  // 汇总累积状态并生成 packet。
  buildPacket(): SpatialMergingAiPacket {
    const summary: SpatialMergingSummary = {
      mergedClusterCount: this.merges.length,
      mergedPartCount: this.merges.reduce((sum, item) => sum + item.partCount, 0),
      rejectedTooLargeCount: countBy(this.rejects, (reason) => reason === "too-large"),
      rejectedRepeatedSequenceCount: countBy(this.rejects, (reason) => reason === "repeated-sequence"),
      maxClusterSize: this.config.maxClusterSize,
      maxPartGap: this.config.maxPartGap,
      repeatedSequenceTolerance: this.config.repeatedSequenceTolerance,
    };
    return createInstrumentationPacket(
      "spatial-merging",
      "merge adjacent icon fragments into a single virtual icon node",
      summary,
      this.merges.map(toMergeRecord),
    );
  }
}

// 将图标合并决策转换为通用 instrumentation 记录。
function toMergeRecord(decision: IconMergeRecord) {
  return createInstrumentationRecord({
    strategyPoint: "icon-merge",
    intent: "explain which fragment nodes are merged into one virtual icon and its resulting box",
    recordType: "icon-merge-decision",
    targetId: decision.mergedId,
    fields: {
      partCount: decision.partCount,
      unionWidth: decision.unionWidth,
      unionHeight: decision.unionHeight,
      position: decision.position,
    },
    payload: decision,
  });
}
