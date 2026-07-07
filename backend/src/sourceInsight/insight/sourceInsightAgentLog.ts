import type {
  SourceInsightAgentEvent,
  SourceInsightAgentLog,
  SourceInsightAgentResult,
  SourceInsightToolTrace,
} from './sourceInsightTypes.ts'
import {
  buildAgentDiagnostics,
  buildPhaseStats,
  buildSearchStats,
  buildStopStats,
} from './sourceInsightAgentDiagnostics.ts'

// 组装 sourceInsight 完成日志详情。
export function buildSourceInsightCompletedDetails(
  result: SourceInsightAgentResult,
  agentEvents: SourceInsightAgentEvent[],
  durationMs: number,
) {
  const toolSteps = result.toolTrace.map(formatToolStep)
  const evidenceRanges = result.evidence.map((item) => ({
    filePath: item.filePath,
    lines: `${item.startLine}-${item.endLine}`,
    reason: item.reason,
  }))
  const agentLog = buildSourceInsightAgentLog(agentEvents, result)

  return {
    durationMs,
    answer: result.answer,
    report: [
      `durationMs: ${durationMs}`,
      `toolCalls: ${result.toolTrace.length}`,
      `evidenceRanges: ${result.evidence.length}`,
      '',
      'toolSteps:',
      ...toolSteps.map((step) => `- ${step}`),
      '',
      'evidence:',
      ...evidenceRanges.map(
        (item) => `- ${item.filePath}:${item.lines} (${item.reason})`,
      ),
      '',
      'answer:',
      result.answer,
    ].join('\n'),
    toolSteps,
    evidenceRanges,
    agentLog,
    summary: {
      toolCallCount: result.toolTrace.length,
      evidenceCount: result.evidence.length,
    },
  }
}

// 聚合 sourceInsight 的 agent 调查日志。
export function buildSourceInsightAgentLog(
  events: SourceInsightAgentEvent[],
  result?: SourceInsightAgentResult,
): SourceInsightAgentLog {
  const toolTrace = result?.toolTrace ?? []
  const eventCounts = countByKey(events.map((event) => event.event))
  const toolCallByName = countByKey(toolTrace.map((trace) => trace.toolName))
  const classifyStep = findLastBy(toolTrace, (trace) => trace.toolName === 'classifyAnomaly')
  const classifiedStrategy =
    typeof classifyStep?.input.strategy === 'string' ? classifyStep.input.strategy : null
  const instrumentationReadCount = toolTrace.filter(
    (trace) =>
      trace.toolName === 'searchInstrumentation' && trace.input.mode === 'read',
  ).length
  const instrumentationListCount = toolTrace.filter(
    (trace) =>
      trace.toolName === 'searchInstrumentation' && trace.input.mode === 'list',
  ).length
  const evidenceFiles = Array.from(
    new Set((result?.evidence ?? []).map((item) => item.filePath)),
  )
  const stopEvent = findEffectiveStopRequest(events, result)
  const stopRequestCount = events.filter(
    (event) => event.event === 'evolvingAgent.stopRequested',
  ).length
  const phases = buildPhaseStats(toolTrace)
  const search = buildSearchStats(toolTrace, evidenceFiles)
  const stopStats = buildStopStats(stopRequestCount, Boolean(stopEvent))

  return {
    eventCounts,
    toolCallCount: toolTrace.length,
    toolCallByName,
    classifiedStrategy,
    instrumentationReadCount,
    instrumentationListCount,
    evidenceCount: result?.evidence.length ?? 0,
    evidenceFiles,
    phases,
    search,
    stopStats,
    diagnostics: buildAgentDiagnostics({
      toolTrace,
      classifiedStrategy,
      instrumentationReadCount,
      instrumentationListCount,
      evidenceCount: result?.evidence.length ?? 0,
      stopStats,
      phases,
      search,
    }),
    stop: stopEvent?.details,
    timeline: summarizeAgentEvents(events, result),
  }
}

// 汇总 agent 关键时间线，便于日志快速回放。
export function summarizeAgentEvents(
  events: SourceInsightAgentEvent[],
  result?: SourceInsightAgentResult,
): string[] {
  const effectiveStopEvent = findEffectiveStopRequest(events, result)

  return events
    .filter((event) => {
      if (event.event === 'evolvingAgent.tool') return true
      return (
        event.event === 'evolvingAgent.stopRequested' &&
        event === effectiveStopEvent
      )
    })
    .map((event, index) => {
      if (event.event === 'evolvingAgent.stopRequested') {
        const details = event.details ?? {}
        return [
          `${index + 1}. evolvingAgent.stopRequested`,
          `reason="${String(details.reason ?? '')}"`,
          `classification="${String(details.classification ?? '')}"`,
          `evidenceCount=${String(details.evidenceCount ?? 0)}`,
        ].join(' ')
      }
      const details = event.details ?? {}
      const input = details.input as Record<string, unknown> | undefined
      const toolName = String(details.toolName ?? 'tool')
      if (toolName === 'exploreSource') {
        return `${index + 1}. exploreSource query="${String(input?.query ?? '')}"`
      }
      if (toolName === 'readFileRange') {
        return [
          `${index + 1}. readFileRange`,
          `${String(input?.filePath ?? '')}:${String(input?.startLine ?? '?')}-${String(input?.endLine ?? '?')}`,
        ].join(' ')
      }
      if (toolName === 'classifyAnomaly') {
        return `${index + 1}. classifyAnomaly strategy="${String(input?.strategy ?? '')}"`
      }
      if (toolName === 'searchInstrumentation') {
        return [
          `${index + 1}. searchInstrumentation`,
          `mode="${String(input?.mode ?? '')}"`,
          `strategyId="${String(input?.strategyId ?? '')}"`,
          `strategyPoint="${String(input?.strategyPoint ?? '')}"`,
        ].join(' ')
      }
      return `${index + 1}. ${toolName}`
    })
}

// 格式化单步工具轨迹。
function formatToolStep(trace: SourceInsightToolTrace, index: number): string {
  const input = trace.input
  const step = `${index + 1}. ${trace.toolName}`

  if (trace.toolName === 'exploreSource') {
    return `${step} query="${String(input.query ?? '')}"`
  }

  if (trace.toolName === 'readFileRange') {
    return [
      `${step}`,
      `${String(input.filePath ?? '')}:${String(input.startLine ?? '?')}-${String(input.endLine ?? '?')}`,
      `reason="${String(input.reason ?? '')}"`,
    ].join(' ')
  }

  return `${step} input=${JSON.stringify(input)}`
}

// 按 key 计数。
function countByKey(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((result, value) => {
    result[value] = (result[value] ?? 0) + 1
    return result
  }, {})
}

// 反向查找最后一个满足条件的值。
function findLastBy<T>(
  values: T[],
  predicate: (value: T) => boolean,
): T | undefined {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index]
    if (predicate(value)) {
      return value
    }
  }
  return undefined
}

// 仅保留真正生效的终态 stop 请求。
function findEffectiveStopRequest(
  events: SourceInsightAgentEvent[],
  result?: SourceInsightAgentResult,
): SourceInsightAgentEvent | undefined {
  const stopRequests = events.filter(
    (event) => event.event === 'evolvingAgent.stopRequested',
  )
  if (stopRequests.length === 0) return undefined

  const toolEventsAfterLastStopRequest = countToolEventsAfterLastStopRequest(events)
  if (toolEventsAfterLastStopRequest > 0) {
    return undefined
  }

  const lastStopRequest = stopRequests[stopRequests.length - 1]
  const details = lastStopRequest.details ?? {}
  if (
    Number(details.toolCallCount ?? 0) > 0 &&
    result &&
    Number(details.toolCallCount) > result.toolTrace.length
  ) {
    return undefined
  }
  return lastStopRequest
}

// 统计最后一次 stopRequested 之后是否仍有工具事件。
function countToolEventsAfterLastStopRequest(
  events: SourceInsightAgentEvent[],
): number {
  let seenStopRequest = false
  let toolCount = 0

  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]
    if (event.event === 'evolvingAgent.stopRequested') {
      seenStopRequest = true
      break
    }
    if (event.event === 'evolvingAgent.tool') {
      toolCount += 1
    }
  }

  return seenStopRequest ? toolCount : 0
}
