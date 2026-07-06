import type {
  SourceInsightLogDiagnostics,
  SourceInsightPhaseStats,
  SourceInsightSearchStats,
  SourceInsightStopStats,
  SourceInsightToolTrace,
} from './sourceInsightTypes.ts'

// 构建阶段统计。
export function buildPhaseStats(
  toolTrace: SourceInsightToolTrace[],
): SourceInsightPhaseStats {
  const classifyIndex = toolTrace.findIndex((trace) => trace.toolName === 'classifyAnomaly')
  const firstEvidenceIndex = toolTrace.findIndex((trace) => trace.toolName === 'readFileRange')
  const firstInstrumentationReadIndex = toolTrace.findIndex(
    (trace) =>
      trace.toolName === 'searchInstrumentation' && trace.input.mode === 'read',
  )

  return {
    classifyToolStep: toToolStep(classifyIndex),
    firstEvidenceToolStep: toToolStep(firstEvidenceIndex),
    firstInstrumentationReadToolStep: toToolStep(firstInstrumentationReadIndex),
    toolCallsBeforeClassification: classifyIndex < 0 ? toolTrace.length : classifyIndex,
    toolCallsAfterClassification: classifyIndex < 0 ? 0 : toolTrace.length - classifyIndex - 1,
    exploreBeforeClassification: countToolCallsInRange(
      toolTrace,
      'exploreSource',
      0,
      classifyIndex < 0 ? toolTrace.length : classifyIndex,
    ),
    exploreAfterClassification: countToolCallsInRange(
      toolTrace,
      'exploreSource',
      classifyIndex < 0 ? toolTrace.length : classifyIndex + 1,
      toolTrace.length,
    ),
    readBeforeClassification: countToolCallsInRange(
      toolTrace,
      'readFileRange',
      0,
      classifyIndex < 0 ? toolTrace.length : classifyIndex,
    ),
    readAfterClassification: countToolCallsInRange(
      toolTrace,
      'readFileRange',
      classifyIndex < 0 ? toolTrace.length : classifyIndex + 1,
      toolTrace.length,
    ),
  }
}

// 构建搜索画像。
export function buildSearchStats(
  toolTrace: SourceInsightToolTrace[],
  evidenceFiles: string[],
): SourceInsightSearchStats {
  const exploreQueries = toolTrace
    .filter((trace) => trace.toolName === 'exploreSource')
    .map((trace) => String(trace.input.query ?? '').trim())
    .filter(Boolean)
  const queryCounts = countByKey(exploreQueries)

  return {
    exploreSourceCount: exploreQueries.length,
    uniqueExploreQueryCount: Object.keys(queryCounts).length,
    repeatedExploreQueries: Object.entries(queryCounts)
      .filter(([, count]) => count > 1)
      .map(([query]) => query),
    readFileRangeCount: toolTrace.filter((trace) => trace.toolName === 'readFileRange').length,
    filesTouchedByRead: evidenceFiles,
  }
}

// 构建 stop 事件统计。
export function buildStopStats(
  stopRequestCount: number,
  hasEffectiveStop: boolean,
): SourceInsightStopStats {
  return {
    stopRequestCount,
    ignoredStopRequestCount: Math.max(0, stopRequestCount - (hasEffectiveStop ? 1 : 0)),
    effectiveStopCount: hasEffectiveStop ? 1 : 0,
    hasEffectiveStop,
  }
}

// 生成自动诊断项，帮助判断 loop 是否还有缺陷。
export function buildAgentDiagnostics(input: {
  toolTrace: SourceInsightToolTrace[]
  classifiedStrategy: string | null
  instrumentationReadCount: number
  instrumentationListCount: number
  evidenceCount: number
  stopStats: SourceInsightStopStats
  phases: SourceInsightPhaseStats
  search: SourceInsightSearchStats
}): SourceInsightLogDiagnostics {
  const anomalies: string[] = []
  const optimizationHints: string[] = []

  if (input.stopStats.ignoredStopRequestCount > 0) {
    anomalies.push(
      `出现 ${input.stopStats.ignoredStopRequestCount} 次未生效的 stop 请求，说明中途曾触发过收敛判定但后续仍继续搜索。`,
    )
  }
  if (!input.classifiedStrategy && input.toolTrace.length >= 4) {
    anomalies.push('进行了多轮工具调用但仍未完成 classifyAnomaly，策略归因阶段可能偏晚或被跳过。')
  }
  if (
    input.classifiedStrategy &&
    input.classifiedStrategy !== 'other' &&
    input.instrumentationListCount > 0 &&
    input.instrumentationReadCount === 0
  ) {
    anomalies.push('已分类为已知策略，但只浏览了 instrumentation 目录，没有真正读取策略记录。')
  }
  if (input.evidenceCount === 0 && input.toolTrace.length > 0) {
    anomalies.push('本次调查没有形成任何 readFileRange 证据，最终结论的可验证性不足。')
  }
  if (
    input.search.exploreSourceCount >= 4 &&
    input.search.readFileRangeCount <= 1
  ) {
    anomalies.push('exploreSource 次数明显高于源码阅读次数，搜索可能偏散，收敛速度不足。')
  }

  if (input.phases.exploreBeforeClassification >= 3) {
    optimizationHints.push('可在拿到第一批高价值源码上下文后更早调用 classifyAnomaly，减少分类前的盲搜。')
  }
  if (input.search.exploreSourceCount > input.search.readFileRangeCount + 1) {
    optimizationHints.push('可降低 exploreSource 频次，更多把命中文件尽快落到 readFileRange 验证。')
  }
  if (input.search.repeatedExploreQueries.length > 0) {
    optimizationHints.push(
      `可对 exploreSource query 去重，避免重复搜索：${input.search.repeatedExploreQueries.join(' | ')}`,
    )
  }
  if (
    input.classifiedStrategy &&
    input.classifiedStrategy !== 'other' &&
    input.instrumentationListCount > input.instrumentationReadCount + 1
  ) {
    optimizationHints.push('已知策略路径下 list 次数偏多，可更快进入 mode="read" 读取具体策略点。')
  }
  if (!input.stopStats.hasEffectiveStop && input.toolTrace.length > 0) {
    optimizationHints.push('本次运行没有记录到终态 stop，可继续观察是否仍有由 recursionLimit 兜底收尾的情况。')
  }

  return { anomalies, optimizationHints }
}

// 按 key 计数。
function countByKey(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1
    return result
  }, {})
}

// 把索引转为工具步号。
function toToolStep(index: number): number | null {
  return index < 0 ? null : index + 1
}

// 统计某段区间内某个工具的调用次数。
function countToolCallsInRange(
  toolTrace: SourceInsightToolTrace[],
  toolName: string,
  start: number,
  end: number,
): number {
  return toolTrace
    .slice(start, end)
    .filter((trace) => trace.toolName === toolName)
    .length
}
