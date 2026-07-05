export type InstrumentationFieldValue = string | number | boolean | null;

// reconstruction pipeline 现有的全部策略 id，作为异常分类与按策略检索的封闭集合。
export const INSTRUMENTATION_STRATEGY_IDS = [
  "occlusion",
  "reparenting",
  "spatial-merging",
  "layout-grouping",
  "adjacency-clustering",
  "semantic-inference",
] as const;

export type InstrumentationStrategyId = (typeof INSTRUMENTATION_STRATEGY_IDS)[number];

export interface InstrumentationRecord {
  strategyPoint: string;
  intent: string;
  recordType: string;
  targetId?: string;
  title?: string;
  fields: Record<string, InstrumentationFieldValue>;
  payload: unknown;
}

export interface InstrumentationPacket<Summary = unknown> {
  strategyId: string;
  intent: string;
  summary: Summary;
  records: InstrumentationRecord[];
}

export interface InstrumentationSearchResult {
  recordType: string;
  score: number;
  title?: string;
  targetId?: string;
  fields: Record<string, InstrumentationFieldValue>;
  recordRef: {
    packetIndex: number;
    recordIndex: number;
  };
}

export interface InstrumentationSearchGroup {
  strategyId: string;
  strategyPoint: string;
  records: InstrumentationSearchResult[];
  totalMatches: number;
  offset: number;
  nextOffset: number | null;
}

export interface InstrumentationStrategyPointDirectory {
  strategyId: string;
  strategyPoint: string;
  intent: string;
}
