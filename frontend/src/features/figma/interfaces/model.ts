export type { ConvertStage, ConvertStageEvent } from '@codify/contracts'

export interface FigmaCodegenResult {
  html: string
  body: string
  css: string
  size?: { width: number; height: number }
}

export interface FigmaConvertResult {
  codegenResult: FigmaCodegenResult
  aiEnhancedResult?: {
    html: string
    css: string
  }
  aiEnhanceMeta?: {
    enabled: boolean
    status: 'skipped' | 'done' | 'failed'
    runId?: string
    error?: string
    events?: Array<{
      event: string
      details?: Record<string, unknown>
    }>
  }
}
