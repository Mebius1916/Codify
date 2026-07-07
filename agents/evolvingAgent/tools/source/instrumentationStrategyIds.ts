// reconstruction pipeline 现有的全部策略 id，作为异常分类与按策略检索的封闭集合。
// 与 design2code 侧的 recordStrategy 保持一致；跨包的常量各自维护，避免 shared 里塞入单向消费的资源。
export const INSTRUMENTATION_STRATEGY_IDS = [
  "occlusion",
  "reparenting",
  "spatial-merging",
  "layout-grouping",
  "adjacency-clustering",
  "semantic-inference",
] as const;

export type InstrumentationStrategyId = (typeof INSTRUMENTATION_STRATEGY_IDS)[number];
