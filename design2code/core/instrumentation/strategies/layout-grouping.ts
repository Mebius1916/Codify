import type { InstrumentationPacket } from "../types.js";
import {
  countBy,
  createInstrumentationPacket,
  createInstrumentationRecord,
} from "../records/packet.js";

export type LayoutDirection = "row" | "column";

// 一次多个流内节点被包进虚拟布局容器的提交型决策。
export type LayoutGroupRecord = {
  groupId: string;
  direction: LayoutDirection;
  childCount: number;
};

// 该算法的阈值配置，由算法层注入以保持单一事实来源。
export type LayoutGroupingConfig = {
  minLayoutGap: number;
};

export interface LayoutGroupingSummary {
  groupCount: number;
  rowGroupCount: number;
  columnGroupCount: number;
  groupedNodeCount: number;
  minLayoutGap: number;
}

export type LayoutGroupingAiPacket = InstrumentationPacket<LayoutGroupingSummary>;

export class LayoutGroupingInstrumentationStrategy {
  private config: LayoutGroupingConfig = { minLayoutGap: 0 };
  private groups: LayoutGroupRecord[] = [];

  // 注入算法阈值，供 summary 复用。
  configure(config: LayoutGroupingConfig): void {
    this.config = config;
  }

  // 记录一次虚拟布局容器的创建。
  recordGroup(record: LayoutGroupRecord): void {
    this.groups.push(record);
  }

  // 汇总累积状态并生成 packet。
  buildPacket(): LayoutGroupingAiPacket {
    const summary: LayoutGroupingSummary = {
      groupCount: this.groups.length,
      rowGroupCount: countBy(this.groups, (item) => item.direction === "row"),
      columnGroupCount: countBy(this.groups, (item) => item.direction === "column"),
      groupedNodeCount: this.groups.reduce((sum, item) => sum + item.childCount, 0),
      minLayoutGap: this.config.minLayoutGap,
    };
    return createInstrumentationPacket(
      "layout-grouping",
      "wrap gap-aligned flow nodes into virtual row/column layout containers",
      summary,
      this.groups.map(toGroupRecord),
    );
  }
}

// 将布局分组决策转换为通用 instrumentation 记录。
function toGroupRecord(decision: LayoutGroupRecord) {
  return createInstrumentationRecord({
    strategyPoint: "layout-grouping",
    intent: "explain why nodes are grouped into a row/column container and how many are grouped",
    recordType: "layout-group-decision",
    targetId: decision.groupId,
    fields: {
      direction: decision.direction,
      childCount: decision.childCount,
    },
    payload: decision,
  });
}
