import type { AgentProgressEvent } from '@codify/agent'
import type { InstrumentationPacket } from '@codify/contracts'

export interface CodegenResult {
  html: string
  body: string
  css: string
  size?: { width: number; height: number }
  instrumentation?: InstrumentationPacket[]
}

export interface FigmaNodeRef {
  fileKey: string
  nodeId: string
}

export interface AiEnhanceResult {
  result?: { html: string; css: string }
  meta: {
    enabled: true
    status: 'done' | 'failed'
    runId: string
    error?: string
    events: AgentProgressEvent[]
  }
}

