import { BadRequestException, Injectable } from '@nestjs/common'
import { runVisualRepair, type AgentProgressEvent } from '@codify/agent'
import { randomUUID } from 'node:crypto'
import { convertHtmlCssToTailwind } from '../../../../converters/index.ts'
import { LoggingService } from '../../logging/loggingService.ts'
import { RenderService } from '../../render/renderService.ts'
import type { ConvertFigmaDto } from '../dto/convertFigmaDto.ts'
import { FigmaApiClient } from './figmaApiClient.ts'
import type { ConvertProgressReporter } from './figmaProgress.ts'
import type { AiEnhanceResult, CodegenResult, ConvertProgressStage, FigmaNodeRef } from '../types/figmaTypes.ts'

const FIGMA_AI_REWRITE_TIMEOUT_MS = 3 * 60_000
const LOGGABLE_AGENT_STATUSES = new Set(['start', 'done', 'error', 'ignored-error'])
const LOGGABLE_TAILWIND_FRAGMENT_MAX_LENGTH = 20_000

type AiEnhanceStage = 'render_baseline' | 'render_current' | 'agent_visual_repair'

interface AiEnhanceStageReporter {
  run<T>(stage: AiEnhanceStage, task: () => Promise<T>): Promise<T>
}

function readPngSize(base64: string): { width: number; height: number } {
  const buffer = Buffer.from(base64, 'base64')
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

@Injectable()
export class FigmaAiEnhanceService {
  constructor(
    private readonly figmaApiClient: FigmaApiClient,
    private readonly renderService: RenderService,
    private readonly loggingService: LoggingService,
  ) {}

  async enhance(input: {
    dto: ConvertFigmaDto
    nodeRef: FigmaNodeRef
    token: string
    codegenResult: CodegenResult
    convertProgress: ConvertProgressReporter
  }): Promise<AiEnhanceResult> {
    const runId = randomUUID()
    const startedAt = Date.now()
    const events: AgentProgressEvent[] = []
    const stage = this.createAiEnhanceStageReporter(runId, input.convertProgress)
    // agent 日志
    const handleAgentProgress = (event: AgentProgressEvent) => {
      events.push(event)
      input.convertProgress.reportAgent(event)
      if (LOGGABLE_AGENT_STATUSES.has(String(event.details?.status))) {
        this.loggingService.info(`AI enhance agent ${event.event}`, {
          runId,
          module: 'figma',
          source: 'agent',
          agentEvent: event.event,
          details: event.details,
        })
      }
    }

    try {
      if (!input.dto.aiOptions?.apiKey?.trim()) throw new BadRequestException('AI enhance 缺少 apiKey')
      const aiOptions = input.dto.aiOptions

      this.loggingService.info('AI enhance started', {
        runId,
        module: 'figma',
        source: 'backend',
        model: aiOptions.model?.trim(),
        nodeId: input.nodeRef.nodeId,
      })
      const baselinePngBase64 = await stage.run('render_baseline', () =>
        this.figmaApiClient.fetchFigmaRenderPngBase64(input.nodeRef, input.token),
      )
      const viewport = readPngSize(baselinePngBase64)
      const currentHtml = await (async () => {
        try {
          const htmlFragment = (input.codegenResult.body || input.codegenResult.html).trim()
          const tailwindFragment = await convertHtmlCssToTailwind(htmlFragment, input.codegenResult.css)
          this.loggingService.info('AI enhance tailwind conversion succeeded', {
            runId,
            module: 'figma',
            source: 'backend',
            currentHtmlLength: tailwindFragment.length,
            tailwindFragment: this.toLoggableTailwindFragment(tailwindFragment),
          })
          return tailwindFragment
        } catch (error) {
          this.loggingService.error('AI enhance tailwind conversion failed, fallback to raw html+css', {
            runId,
            module: 'figma',
            source: 'backend',
            error: this.formatError(error),
          })
          return '';
        }
      })()
      const { buffer } = await stage.run('render_current', () =>
        this.renderService.renderHtmlToImage({
          html: currentHtml,
          width: viewport.width,
          height: viewport.height,
          format: 'png',
          fullPage: false,
          deviceScaleFactor: 1,
        }),
      )

      const result = await stage.run('agent_visual_repair', () =>
        runVisualRepair({
          baselinePngBase64,
          currentPngBase64: buffer.toString('base64'),
          html: currentHtml,
          model: aiOptions.model?.trim() || 'gemini-2.5-flash',
          apiKey: aiOptions.apiKey.trim(),
          baseUrl: aiOptions.baseUrl.trim(),
          temperature: aiOptions.temperature ?? 0,
          threshold: 0.1,
          rewriteTimeoutMs: FIGMA_AI_REWRITE_TIMEOUT_MS,
          onProgress: handleAgentProgress,
        }),
      )

      this.loggingService.info('AI enhance completed', {
        runId,
        module: 'figma',
        source: 'backend',
        durationMs: Date.now() - startedAt,
      })
      return {
        result,
        meta: { enabled: true, status: 'done', runId, events },
      }
    } catch (error) {
      this.loggingService.error('AI enhance failed', {
        runId,
        module: 'figma',
        source: 'backend',
        durationMs: Date.now() - startedAt,
        error: this.formatError(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return {
        meta: {
          enabled: true,
          status: 'failed',
          runId,
          error: this.formatError(error),
          events,
        },
      }
    }
  }

  private createAiEnhanceStageReporter(
    runId: string,
    convertProgress: ConvertProgressReporter,
  ): AiEnhanceStageReporter {
    return {
      run: async <T>(stage: AiEnhanceStage, task: () => Promise<T>): Promise<T> => {
        const startedAt = Date.now()
        const logStage = stage.replaceAll('_', '-')
        if (stage !== 'agent_visual_repair') {
          convertProgress.report(stage satisfies ConvertProgressStage)
        }
        try {
          const result = await task()
          this.loggingService.info('AI enhance stage completed', {
            runId,
            module: 'figma',
            source: 'backend',
            stage: logStage,
            durationMs: Date.now() - startedAt,
          })
          return result
        } catch (error) {
          this.loggingService.error('AI enhance stage failed', {
            runId,
            module: 'figma',
            source: 'backend',
            stage: logStage,
            durationMs: Date.now() - startedAt,
            error: this.formatError(error),
            stack: error instanceof Error ? error.stack : undefined,
          })
          throw error
        }
      },
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
  }

  private toLoggableTailwindFragment(fragment: string): string {
    if (fragment.length <= LOGGABLE_TAILWIND_FRAGMENT_MAX_LENGTH) return fragment
    return `${fragment.slice(0, LOGGABLE_TAILWIND_FRAGMENT_MAX_LENGTH)}...[truncated]`
  }

}
