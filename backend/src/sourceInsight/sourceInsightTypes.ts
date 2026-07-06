import { runEvolvingAgent } from '@codify/evolving-agent'
import type { VisualRepairObserveResult } from '@codify/agent'
import type { FigmaNodeRef } from '../conversion/types.ts'

export interface SourceInsightStartInput {
  aiEnhanceRunId: string
  nodeRef: FigmaNodeRef
  observe: VisualRepairObserveResult
  model: string
  apiKey: string
  baseUrl: string
}

export type SourceInsightAgentEvent = {
  event: string
  details?: Record<string, unknown>
}

export type SourceInsightAgentResult = Awaited<ReturnType<typeof runEvolvingAgent>>

export type SourceInsightToolTrace = SourceInsightAgentResult['toolTrace'][number]

export type SourceInsightLogDiagnostics = {
  anomalies: string[]
  optimizationHints: string[]
}

export type SourceInsightPhaseStats = {
  classifyToolStep: number | null
  firstEvidenceToolStep: number | null
  firstInstrumentationReadToolStep: number | null
  toolCallsBeforeClassification: number
  toolCallsAfterClassification: number
  exploreBeforeClassification: number
  exploreAfterClassification: number
  readBeforeClassification: number
  readAfterClassification: number
}

export type SourceInsightSearchStats = {
  exploreSourceCount: number
  uniqueExploreQueryCount: number
  repeatedExploreQueries: string[]
  readFileRangeCount: number
  filesTouchedByRead: string[]
}

export type SourceInsightStopStats = {
  stopRequestCount: number
  ignoredStopRequestCount: number
  effectiveStopCount: number
  hasEffectiveStop: boolean
}

export type SourceInsightAgentLog = {
  eventCounts: Record<string, number>
  toolCallCount: number
  toolCallByName: Record<string, number>
  classifiedStrategy: string | null
  instrumentationReadCount: number
  instrumentationListCount: number
  evidenceCount: number
  evidenceFiles: string[]
  phases: SourceInsightPhaseStats
  search: SourceInsightSearchStats
  stopStats: SourceInsightStopStats
  diagnostics: SourceInsightLogDiagnostics
  stop?: Record<string, unknown>
  timeline: string[]
}
