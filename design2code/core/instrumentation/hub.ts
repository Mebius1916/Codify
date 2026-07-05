import type { InstrumentationPacket } from "./types.js";
import { OcclusionInstrumentationStrategy } from "./strategies/occlusion.js";
import { ReparentingInstrumentationStrategy } from "./strategies/reparenting.js";
import { SpatialMergingInstrumentationStrategy } from "./strategies/spatial-merging.js";
import { LayoutGroupingInstrumentationStrategy } from "./strategies/layout-grouping.js";
import { AdjacencyClusteringInstrumentationStrategy } from "./strategies/adjacency-clustering.js";
import { SemanticInferenceInstrumentationStrategy } from "./strategies/semantic-inference.js";

// 聚合 reconstruction pipeline 全部策略的采集中心，作为共享累积实例贯穿双重递归。
export class InstrumentationHub {
  readonly occlusion = new OcclusionInstrumentationStrategy();
  readonly reparenting = new ReparentingInstrumentationStrategy();
  readonly spatialMerging = new SpatialMergingInstrumentationStrategy();
  readonly layoutGrouping = new LayoutGroupingInstrumentationStrategy();
  readonly adjacencyClustering = new AdjacencyClusteringInstrumentationStrategy();
  readonly semanticInference = new SemanticInferenceInstrumentationStrategy();

  // 汇总所有策略的 packet，交由上层持久化存储。
  collectPackets(): InstrumentationPacket[] {
    return [
      this.occlusion.buildPacket(),
      this.reparenting.buildPacket(),
      this.spatialMerging.buildPacket(),
      this.layoutGrouping.buildPacket(),
      this.adjacencyClustering.buildPacket(),
      this.semanticInference.buildPacket(),
    ];
  }
}
