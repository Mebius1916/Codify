import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { runEvolvingAgent } from '@codify/evolving-agent'
import { env } from '../../platform/config/env.ts'
import type { FigmaNodeRef } from '../../conversion/shared/types.ts'
import { appDatabase } from '../../platform/database/appDatabase.ts'
import { formatError, formatErrorCause } from '../../platform/logging/loggingUtils.ts'
import { LoggingService } from '../../platform/logging/loggingService.ts'
import { SourceRepositoryService } from '../repository/sourceRepositoryService.ts'
import {
  hasInstrumentationPackets,
  listNodeStrategyPoints,
  readNodeStrategyPoint,
} from './instrumentationStore.ts'
import { buildSourceInsightAgentLog } from './sourceInsightAgentLog.ts'
import { buildSourceInsightPrompt } from './sourceInsightPrompt.ts'
import type {
  SourceInsightAgentEvent,
  SourceInsightStartInput,
} from './sourceInsightTypes.ts'

interface SourceInsightRunRow {
  id: string
}

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
      fileKey: input.nodeRef.fileKey,
      nodeId: input.nodeRef.nodeId,
    })

    void this.runSourceInsight(runId, prompt, input.nodeRef, {
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
    nodeRef: FigmaNodeRef,
    modelOptions: { model: string; apiKey: string; baseUrl: string },
  ): Promise<void> {
    const syncedSource = this.sourceRepositoryService.syncLocalSource()

    if (!syncedSource) {
      this.markSkipped(runId, 'No database source files found for source insight')
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

    const hasInstrumentation = hasInstrumentationPackets(nodeRef)
    const instrumentationProvider = hasInstrumentation
      ? {
          listStrategyPoints: () => listNodeStrategyPoints(nodeRef),
          readStrategyPoint: (
            strategyId: string,
            strategyPoint: string,
            options?: { query?: string; limit?: number; offset?: number },
          ) => readNodeStrategyPoint(nodeRef, strategyId, strategyPoint, options),
        }
      : undefined

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
          maxToolCalls: env.sourceInsight.maxToolCalls,
          maxReadLinesPerCall: 120,
          maxGraphResults: 30,
          maxListedFiles: env.sourceInsight.maxListedFiles,
          maxToolTracePreviewChars: env.sourceInsight.maxToolTracePreviewChars,
        },
        contextCompression: {
          contextWindowTokens: env.sourceInsight.contextWindowTokens,
          compressRatio: env.sourceInsight.compressRatio,
          keepRatio: env.sourceInsight.contextKeepRatio,
        },
        instrumentationProvider,
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

      const agentLog = buildSourceInsightAgentLog(agentEvents, result)

      this.loggingService.info('Source insight completed', {
        runId,
        module: 'sourceInsight',
        source: 'agent',
        durationMs: Date.now() - startedAt,
        toolCallCount: agentLog.toolCallCount,
        evidenceCount: agentLog.evidenceCount,
        classifiedStrategy: agentLog.classifiedStrategy,
        instrumentationReadCount: agentLog.instrumentationReadCount,
        hasEffectiveStop: agentLog.stopStats.hasEffectiveStop,
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

      const agentLog = buildSourceInsightAgentLog(agentEvents)

      this.loggingService.error('Source insight failed', {
        runId,
        module: 'sourceInsight',
        source: 'backend',
        durationMs: Date.now() - startedAt,
        toolCallCount: agentLog.toolCallCount,
        classifiedStrategy: agentLog.classifiedStrategy,
        instrumentationReadCount: agentLog.instrumentationReadCount,
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
