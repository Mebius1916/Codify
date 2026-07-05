import type { InstrumentationPacket } from "../types.js";
import {
  countBy,
  createInstrumentationPacket,
  createInstrumentationRecord,
} from "../records/packet.js";

export type ClusterDirection = "row" | "column";

// 一次相邻节点被聚成虚拟内容组的提交型决策。
export type AdjacencyClusterRecord = {
  groupId: string;
  direction: ClusterDirection;
  memberCount: number;
};

// 该算法的阈值配置，由算法层注入以保持单一事实来源。
export type AdjacencyClusteringConfig = {
  maxMainAxisGapRatio: number;
  minCrossAxisOverlapRatio: number;
  maxMergedEmptyRatio: number;
};

export interface AdjacencyClusteringSummary {
  clusterCount: number;
  rowClusterCount: number;
  columnClusterCount: number;
  clusteredNodeCount: number;
  maxMainAxisGapRatio: number;
  minCrossAxisOverlapRatio: number;
  maxMergedEmptyRatio: number;
}

export type AdjacencyClusteringAiPacket = InstrumentationPacket<AdjacencyClusteringSummary>;

export class AdjacencyClusteringInstrumentationStrategy {
  private config: AdjacencyClusteringConfig = {
    maxMainAxisGapRatio: 0,
    minCrossAxisOverlapRatio: 0,
    maxMergedEmptyRatio: 0,
  };
  private clusters: AdjacencyClusterRecord[] = [];

  // 注入算法阈值，供 summary 复用。
  configure(config: AdjacencyClusteringConfig): void {
    this.config = config;
  }

  // 记录一次相邻聚类虚拟组的创建。
  recordCluster(record: AdjacencyClusterRecord): void {
    this.clusters.push(record);
  }

  // 汇总累积状态并生成 packet。
  buildPacket(): AdjacencyClusteringAiPacket {
    const summary: AdjacencyClusteringSummary = {
      clusterCount: this.clusters.length,
      rowClusterCount: countBy(this.clusters, (item) => item.direction === "row"),
      columnClusterCount: countBy(this.clusters, (item) => item.direction === "column"),
      clusteredNodeCount: this.clusters.reduce((sum, item) => sum + item.memberCount, 0),
      maxMainAxisGapRatio: this.config.maxMainAxisGapRatio,
      minCrossAxisOverlapRatio: this.config.minCrossAxisOverlapRatio,
      maxMergedEmptyRatio: this.config.maxMergedEmptyRatio,
    };
    return createInstrumentationPacket(
      "adjacency-clustering",
      "cluster mutually adjacent nodes into virtual content groups by axis proximity",
      summary,
      this.clusters.map(toClusterRecord),
    );
  }
}

// 将相邻聚类决策转换为通用 instrumentation 记录。
function toClusterRecord(decision: AdjacencyClusterRecord) {
  return createInstrumentationRecord({
    strategyPoint: "adjacency-cluster",
    intent: "explain which adjacent nodes are clustered into a content group and its direction",
    recordType: "adjacency-cluster-decision",
    targetId: decision.groupId,
    fields: {
      direction: decision.direction,
      memberCount: decision.memberCount,
    },
    payload: decision,
  });
}
