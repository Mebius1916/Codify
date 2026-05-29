import type { AgentProgressEvent } from '@codify/agent'
import type { ConvertProgressEvent, ConvertProgressStage } from '../types/figmaTypes.ts'

type ProgressSink = (event: ConvertProgressEvent) => void
export interface ConvertProgressReporter {
  report(stage: ConvertProgressStage): void
  reportAgent(event: AgentProgressEvent): void
}

export const CONVERT_PROGRESS_LABELS = {
  figma_fetch: '正在获取 Figma 数据',
  codegen: '转换算法运行中',
  render_baseline: '正在生成 Figma 基准截图',
  render_current: '正在生成当前页面截图',
  observe: '正在观察视觉差异',
  plan: '正在生成修复计划',
  rewrite: 'AI 优化中',
  completed: '转换完成',
  failed: '转换失败',
} satisfies Record<ConvertProgressStage, string>

const AGENT_PROGRESS_STAGES = new Set<ConvertProgressStage>(['observe', 'plan', 'rewrite'])

export function createConvertProgressReporter(onProgress?: ProgressSink): ConvertProgressReporter {
  const reportedAgentStages = new Set<ConvertProgressStage>()

  const report = (stage: ConvertProgressStage) => {
    onProgress?.({
      stage,
      label: CONVERT_PROGRESS_LABELS[stage],
    })
  }

  return {
    report,
    reportAgent(event) {
      const stage = event.event as ConvertProgressStage
      if (!AGENT_PROGRESS_STAGES.has(stage) || reportedAgentStages.has(stage)) return

      reportedAgentStages.add(stage)
      report(stage)
    },
  }
}
