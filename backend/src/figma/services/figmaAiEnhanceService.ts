import { BadRequestException, Injectable } from '@nestjs/common'
import { runVisualRepair, type AgentProgressEvent } from '@codify/agent'
import { randomUUID } from 'node:crypto'
import { LoggingService } from '../../logging/loggingService.ts'
import { RenderService } from '../../render/renderService.ts'
import type { ConvertFigmaDto } from '../dto/convertFigmaDto.ts'
import { FigmaApiClient } from './figmaApiClient.ts'
import type { ConvertProgressReporter } from './figmaProgress.ts'
import type { AiEnhanceResult, CodegenResult, FigmaNodeRef } from '../types/figmaTypes.ts'

const FIGMA_AI_ENHANCE_TIMEOUT_MS = 5 * 60_000
const LOGGABLE_AGENT_EVENT_SUFFIXES = [':done', ':error', ':ignored-error']

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
    const events: AgentProgressEvent[] = []
    // agent 日志
    const handleAgentProgress = (event: AgentProgressEvent) => {
      events.push(event)
      input.convertProgress.reportAgent(event)
      if (LOGGABLE_AGENT_EVENT_SUFFIXES.some((suffix) => event.event.endsWith(suffix))) {
        this.loggingService.info('AI enhance agent progress', {
          runId,
          module: 'figma',
          source: 'agent',
          event: event.event,
          details: event.details,
        })
      }
    }

    try {
      if (!input.dto.aiOptions?.apiKey?.trim()) throw new BadRequestException('AI enhance 缺少 apiKey')

      this.loggingService.info('AI enhance started', {
        runId,
        module: 'figma',
        source: 'backend',
        event: 'ai-enhance:start',
        model: input.dto.aiOptions.model?.trim(),
        nodeId: input.nodeRef.nodeId,
      })
      input.convertProgress.report('render_baseline')
      const baselinePngBase64 = await this.figmaApiClient.fetchFigmaRenderPngBase64(input.nodeRef, input.token)
      const viewport = readPngSize(baselinePngBase64)
      const currentHtml = this.buildRenderableHtml(input.codegenResult)
      input.convertProgress.report('render_current')
      const { buffer } = await this.renderService.renderHtmlToImage({
        html: currentHtml,
        width: viewport.width,
        height: viewport.height,
        format: 'png',
        fullPage: false,
        deviceScaleFactor: 1,
      })

      const abortController = new AbortController()
      const result = await this.withTimeout(
        runVisualRepair({
          baselinePngBase64,
          currentPngBase64: buffer.toString('base64'),
          html: currentHtml,
          model: input.dto.aiOptions.model?.trim() || 'gpt-4o',
          apiKey: input.dto.aiOptions.apiKey.trim(),
          baseUrl: input.dto.aiOptions.baseUrl.trim(),
          temperature: input.dto.aiOptions.temperature ?? 0,
          threshold: 0.1,
          onProgress: handleAgentProgress,
          abortSignal: abortController.signal,
        }),
        FIGMA_AI_ENHANCE_TIMEOUT_MS,
        'AI enhance 超时，请检查模型接口是否可用或稍后重试',
        () => abortController.abort(),
      )

      this.loggingService.info('AI enhance completed', {
        runId,
        module: 'figma',
        source: 'backend',
        event: 'ai-enhance:done',
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
        event: 'ai-enhance:failed',
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

  private buildRenderableHtml(result: CodegenResult): string {
    if (!result.css.trim()) return result.html
    if (/<\/head>/i.test(result.html)) {
      return result.html.replace(/<\/head>/i, `<style>${result.css}</style></head>`)
    }
    return `<style>${result.css}</style>${result.html}`
  }

  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    message: string,
    onTimeout?: () => void,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        onTimeout?.()
        reject(new Error(message))
      }, timeoutMs)
      promise.then(
        (value) => {
          clearTimeout(timeoutId)
          resolve(value)
        },
        (error: unknown) => {
          clearTimeout(timeoutId)
          reject(error)
        },
      )
    })
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
  }

}
