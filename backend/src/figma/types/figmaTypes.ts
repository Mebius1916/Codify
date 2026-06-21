import type { AgentProgressEvent } from '../../../../agents/dist'

export interface CodegenResult {
  html: string
  body: string
  css: string
  size?: { width: number; height: number }
}

export interface FigmaNodeRef {
  fileKey: string
  nodeId: string
}

export type ConvertProgressStage =
  | 'figma_fetch'
  | 'codegen'
  | 'render_baseline'
  | 'render_current'
  | 'observe'
  | 'plan'
  | 'rewrite'
  | 'completed'
  | 'failed'

export interface ConvertProgressEvent {
  stage: ConvertProgressStage
  label: string
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
