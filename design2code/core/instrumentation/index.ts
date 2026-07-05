export { InstrumentationHub } from "./hub.js";
export {
  OcclusionInstrumentationStrategy,
  type OcclusionAiPacket,
  type OcclusionStageSummary,
} from "./strategies/occlusion.js";
export {
  ReparentingInstrumentationStrategy,
  type ReparentingAiPacket,
  type ReparentingSummary,
} from "./strategies/reparenting.js";
export {
  SpatialMergingInstrumentationStrategy,
  type SpatialMergingAiPacket,
  type SpatialMergingSummary,
} from "./strategies/spatial-merging.js";
export {
  LayoutGroupingInstrumentationStrategy,
  type LayoutGroupingAiPacket,
  type LayoutGroupingSummary,
} from "./strategies/layout-grouping.js";
export {
  AdjacencyClusteringInstrumentationStrategy,
  type AdjacencyClusteringAiPacket,
  type AdjacencyClusteringSummary,
} from "./strategies/adjacency-clustering.js";
export {
  SemanticInferenceInstrumentationStrategy,
  type SemanticInferenceAiPacket,
  type SemanticInferenceSummary,
} from "./strategies/semantic-inference.js";
export {
  average,
  countBy,
  createInstrumentationPacket,
  createInstrumentationRecord,
} from "./records/packet.js";
export type {
  InstrumentationPacket,
  InstrumentationRecord,
} from "./types.js";
