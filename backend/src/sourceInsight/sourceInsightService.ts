import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { env } from '../config/env.ts'
import { appDatabase } from '../database/appDatabase.ts'
import { formatError, formatErrorCause } from '../logging/loggingUtils.ts'
import { LoggingService } from '../logging/loggingService.ts'
import { SourceRepositoryService } from '../sourceRepository/sourceRepositoryService.ts'
import { runEvolvingAgent } from '@codify/evolving-agent'
import type { VisualRepairObserveResult } from '@codify/agent'

export interface SourceInsightStartInput {
  aiEnhanceRunId: string
  nodeRef: {
    fileKey: string
    nodeId: string
  }
  observe: VisualRepairObserveResult
  model: string
  apiKey: string
  baseUrl: string
}

interface SourceInsightRunRow {
  id: string
}

type SourceInsightAgentEvent = {
  event: string
  details?: Record<string, unknown>
}

type SourceInsightAgentResult = Awaited<ReturnType<typeof runEvolvingAgent>>
type SourceInsightToolTrace = SourceInsightAgentResult['toolTrace'][number]

const SOURCE_INSIGHT_MAX_TOOL_CALLS = 100
const SOURCE_INSIGHT_INCLUDE_DIRS = ['design2code']

@Injectable()
export class SourceInsightService {
  constructor(
    private readonly loggingService: LoggingService,
    private readonly sourceRepositoryService: SourceRepositoryService,
  ) {}

  startFromObserve(input: SourceInsightStartInput): string {
    const prompt = buildSourceInsightPrompt(input)
    const runId = randomUUID()

    appDatabase
      .prepare(`
        INSERT INTO source_insight_runs (
          id,
          ai_enhance_run_id,
          figma_file_key,
          figma_node_id,
          status,
          prompt
        ) VALUES (?, ?, ?, ?, ?, ?)
      `)
      .run(
        runId,
        input.aiEnhanceRunId,
        input.nodeRef.fileKey,
        input.nodeRef.nodeId,
        'pending',
        prompt,
      )

    this.loggingService.info('Source insight queued', {
      runId,
      module: 'sourceInsight',
      source: 'backend',
      aiEnhanceRunId: input.aiEnhanceRunId,
      nodeId: input.nodeRef.nodeId,
    })

    void this.runSourceInsight(runId, prompt, {
      model: input.model,
      apiKey: input.apiKey,
      baseUrl: input.baseUrl,
    })
    return runId
  }

  getRun(id: string): SourceInsightRunRow | undefined {
    return appDatabase
      .prepare('SELECT id FROM source_insight_runs WHERE id = ?')
      .get(id) as SourceInsightRunRow | undefined
  }

  private async runSourceInsight(
    runId: string,
    prompt: string,
    modelOptions: { model: string; apiKey: string; baseUrl: string },
  ): Promise<void> {
    const syncedSource = this.sourceRepositoryService.syncLocalSource()

    if (!syncedSource) {
      this.markSkipped(
        runId,
        'No database source files found for source insight',
      )
      return
    }
    if (!modelOptions.apiKey.trim()) {
      this.markSkipped(runId, 'MODEL_API_KEY or aiOptions.apiKey is not configured')
      return
    }
    if (!modelOptions.baseUrl.trim()) {
      this.markSkipped(runId, 'aiOptions.baseUrl is not configured')
      return
    }

    this.loggingService.info('Source insight started', {
      runId,
      module: 'sourceInsight',
      source: 'backend',
      repoRoot: syncedSource.repoRoot,
      includeDirs: SOURCE_INSIGHT_INCLUDE_DIRS,
      syncedSource,
      budget: {
        maxToolCalls: SOURCE_INSIGHT_MAX_TOOL_CALLS,
        maxReadLinesPerCall: 120,
        maxGraphResults: 30,
      },
    })

    const startedAt = Date.now()
    const agentEvents: SourceInsightAgentEvent[] = []

    try {
      const result = await runEvolvingAgent({
        question: prompt,
        repoRoot: syncedSource.repoRoot,
        includeDirs: SOURCE_INSIGHT_INCLUDE_DIRS,
        model: modelOptions.model || 'gemini-2.5-flash',
        apiKey: modelOptions.apiKey,
        baseUrl: modelOptions.baseUrl,
        temperature: 0,
        timeout: env.sourceInsight.timeoutMs,
        budget: {
          maxToolCalls: SOURCE_INSIGHT_MAX_TOOL_CALLS,
          maxReadLinesPerCall: 120,
          maxGraphResults: 30,
        },
        onProgress: (event) => {
          agentEvents.push(event)
        },
      })

      appDatabase
        .prepare(`
          UPDATE source_insight_runs
          SET status = 'done',
              answer = ?,
              evidence_json = ?,
              tool_trace_json = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(
          result.answer,
          JSON.stringify(result.evidence),
          JSON.stringify(result.toolTrace),
          runId,
        )

      this.loggingService.info('Source insight completed', {
        runId,
        module: 'sourceInsight',
        source: 'agent',
        ...buildSourceInsightCompletedDetails(result, Date.now() - startedAt),
      })
    } catch (error) {
      appDatabase
        .prepare(`
          UPDATE source_insight_runs
          SET status = 'failed',
              error = ?,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `)
        .run(formatError(error), runId)

      this.loggingService.error('Source insight failed', {
        runId,
        module: 'sourceInsight',
        source: 'backend',
        durationMs: Date.now() - startedAt,
        partialToolSteps: summarizeAgentEvents(agentEvents),
        error: formatError(error),
        errorCause: formatErrorCause(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
    }
  }

  private markSkipped(runId: string, reason: string): void {
    appDatabase
      .prepare(`
        UPDATE source_insight_runs
        SET status = 'skipped',
            error = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `)
      .run(reason, runId)

    this.loggingService.warn('Source insight skipped', {
      runId,
      module: 'sourceInsight',
      source: 'backend',
      reason,
    })
  }
}

function buildSourceInsightPrompt(input: SourceInsightStartInput): string {
  return [
    '你是源码分析 agent。请根据下面 visual observe 阶段的观察结果，静默分析源码中最可能相关的实现位置，并给出给后续修复阶段参考的工程建议。',
    '',
    '要求：',
    '- 只分析源码，不修改代码。',
    '- 优先指出相关文件、函数、数据流和可能影响视觉差异的实现点。',
    '- 输出简洁建议，适合作为后台分析意见存入数据库。',
    '- 如果证据不足，明确说明不确定点。',
    '- 最多做少量高价值源码探索，拿到可用建议后立即停止，不要穷尽整个仓库。',
    '- 可分析源码范围已经固定为 design2code，只需要决定搜索什么，不需要决定去哪里搜。',
    '- 优先围绕 observe 中的视觉问题类型搜索 HTML 生成、CSS 生成、布局、文本、图片、样式提取相关实现。',
    '- 每个主要结论必须至少有一个 readFileRange 证据支撑，并引用文件路径与行号。',
    '- 只通过 exploreSource 看到但没有 readFileRange 验证过的文件，只能放入“待验证候选方向”，不能写成确定结论。',
    '- 最终回答请分为“已验证结论”和“待验证候选方向”。',
    '',
    `<figmaNode fileKey="${input.nodeRef.fileKey}" nodeId="${input.nodeRef.nodeId}" />`,
    '',
    '<observe>',
    JSON.stringify(input.observe, null, 2),
    '</observe>',
  ].join('\n')
}

function buildSourceInsightCompletedDetails(
  result: SourceInsightAgentResult,
  durationMs: number,
) {
  const toolSteps = result.toolTrace.map(formatToolStep)
  const evidenceRanges = result.evidence.map((item) => ({
    filePath: item.filePath,
    lines: `${item.startLine}-${item.endLine}`,
    reason: item.reason,
  }))

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
    summary: {
      toolCallCount: result.toolTrace.length,
      evidenceCount: result.evidence.length,
    },
  }
}

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

function summarizeAgentEvents(events: SourceInsightAgentEvent[]): string[] {
  return events
    .filter((event) => event.event === 'evolvingAgent.tool')
    .map((event, index) => {
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
      return `${index + 1}. ${toolName}`
    })
}
