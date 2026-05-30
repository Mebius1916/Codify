import {
  AlertTriangle,
  Braces,
  Camera,
  Check,
  FileSearch,
  Layers3,
  ListChecks,
  Sparkles,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { ConvertStage } from '../interfaces/model'

export interface ConvertStageMeta {
  stage: ConvertStage
  title: string
  shortLabel: string
  Icon: ComponentType<{ className?: string }>
}

export const CONVERT_STAGE_ITEMS: ConvertStageMeta[] = [
  { stage: 'figma_fetch', title: 'Source Intake', shortLabel: 'Source', Icon: FileSearch },
  { stage: 'codegen', title: 'Code Generation', shortLabel: 'Code', Icon: Braces },
  { stage: 'render_baseline', title: 'Baseline Capture', shortLabel: 'Base', Icon: Camera },
  { stage: 'render_current', title: 'Preview Render', shortLabel: 'Render', Icon: Layers3 },
  { stage: 'observe', title: 'Observe', shortLabel: 'Observe', Icon: ListChecks },
  { stage: 'plan', title: 'Plan', shortLabel: 'Plan', Icon: ListChecks },
  { stage: 'rewrite', title: 'Rewrite', shortLabel: 'Rewrite', Icon: Sparkles },
  { stage: 'completed', title: 'Ready', shortLabel: 'Done', Icon: Check },
]

const FAILED_STAGE: ConvertStageMeta = {
  stage: 'failed',
  title: 'Interrupted',
  shortLabel: 'Failed',
  Icon: AlertTriangle,
}

export function getConvertStageMeta(stage?: ConvertStage) {
  if (stage === 'failed') return FAILED_STAGE
  return CONVERT_STAGE_ITEMS.find((item) => item.stage === stage) ?? CONVERT_STAGE_ITEMS[0]
}

export function getConvertStageIndex(stage?: ConvertStage) {
  if (!stage) return 0
  if (stage === 'failed') return CONVERT_STAGE_ITEMS.length - 1
  return Math.max(0, CONVERT_STAGE_ITEMS.findIndex((item) => item.stage === stage))
}

export function getConvertStageProgress(stage?: ConvertStage) {
  if (!stage) return 7
  if (stage === 'failed' || stage === 'completed') return 100

  const index = getConvertStageIndex(stage)
  return Math.max(7, Math.round((index / (CONVERT_STAGE_ITEMS.length - 1)) * 100))
}
