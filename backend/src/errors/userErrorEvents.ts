import { formatError } from '../logging/loggingUtils.ts'

export type FigmaApiStep = 'fetch_node' | 'export_image' | 'download_image'

export type AiEnhanceStage = 'render_baseline' | 'render_current' | 'visual_attention' | 'agent_visual_repair'

type UserErrorEvent =
  | { type: 'figma.url.invalid' }
  | { type: 'figma.api.network'; step: FigmaApiStep; error: unknown }
  | { type: 'figma.api.response'; step: FigmaApiStep; responseSummary: string }
  | { type: 'figma.image.missing'; nodeId: string }
  | { type: 'render.html.failed'; error: unknown }
  | { type: 'render.html.restart_failed' }
  | { type: 'ai.model_api_key.missing' }
  | { type: 'ai.model_endpoint.missing' }
  | { type: 'ai.enhance_stage.failed'; stage: AiEnhanceStage; runId: string; error: unknown }

const FIGMA_API_STEP_LABELS = {
  fetch_node: '获取 Figma 数据',
  export_image: '导出 Figma 图片',
  download_image: '下载图片资源',
} satisfies Record<FigmaApiStep, string>

const AI_ENHANCE_STAGE_LABELS = {
  render_baseline: 'Figma 基准图',
  render_current: '当前页面截图',
  visual_attention: '视觉差异分析',
  agent_visual_repair: 'AI 视觉修复',
} satisfies Record<AiEnhanceStage, string>

export function formatUserError(event: UserErrorEvent): string {
  switch (event.type) {
    case 'figma.url.invalid':
      return 'Figma 链接无效：请粘贴完整的文件链接。'
    case 'figma.api.network':
      return `${FIGMA_API_STEP_LABELS[event.step]}失败：后端无法连接到 Figma。请检查网络或代理。${formatOriginalError(event.error)}`
    case 'figma.api.response':
      return formatFigmaApiResponseError(event.step, event.responseSummary)
    case 'figma.image.missing':
      return `Figma 图片导出失败：node-id=${event.nodeId} 未返回图片地址。`
    case 'render.html.failed':
      return `截图渲染失败：请检查 HTML 和外部资源是否可访问。${formatOriginalError(event.error)}`
    case 'render.html.restart_failed':
      return '截图渲染失败：重启浏览器后仍未成功。'
    case 'ai.model_api_key.missing':
      return 'AI 增强失败：缺少 Model API Key。'
    case 'ai.model_endpoint.missing':
      return 'AI 增强失败：缺少 Model API Endpoint。'
    case 'ai.enhance_stage.failed':
      return formatAiEnhanceStageError(event.stage, event.runId, event.error)
  }
}

function formatFigmaApiResponseError(step: FigmaApiStep, responseSummary: string): string {
  if (step === 'fetch_node') {
    return `获取 Figma 数据失败：请检查 Token、文件权限或 node-id。${responseSummary}`
  }
  if (step === 'export_image') {
    return `导出 Figma 图片失败：请检查权限或节点是否可导出。${responseSummary}`
  }
  return `下载图片资源失败：远程资源不可访问。${responseSummary}`
}

function formatAiEnhanceStageError(stage: AiEnhanceStage, runId: string, error: unknown): string {
  return `AI 增强失败：${AI_ENHANCE_STAGE_LABELS[stage]}阶段出错。${getAiEnhanceStageHint(stage)} runId=${runId}。${formatOriginalError(error)}`
}

function getAiEnhanceStageHint(stage: AiEnhanceStage): string {
  if (stage === 'render_baseline') {
    return '请检查 Figma Token、权限或 node-id。'
  }
  if (stage === 'render_current') {
    return '请检查 HTML/CSS 和外部资源。'
  }
  if (stage === 'visual_attention') {
    return '请检查截图是否生成成功。'
  }
  return '请检查模型 Endpoint、Key 和模型名。'
}

function formatOriginalError(error: unknown): string {
  const message = formatError(error).trim()
  return message ? `原始错误：${message}` : ''
}
