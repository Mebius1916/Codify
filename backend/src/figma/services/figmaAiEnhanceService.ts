import { BadRequestException, Injectable } from '@nestjs/common'
import { runVisualRepair, type AgentProgressEvent } from '@codify/agent'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { convertHtmlCssToTailwind } from '../../../../converters/index.ts'
import { env } from '../../config/env.ts'
import { formatUserError, type AiEnhanceStage } from '../../errors/userErrorEvents.ts'
import { formatError, formatErrorCause } from '../../logging/loggingUtils.ts'
import { LoggingService } from '../../logging/loggingService.ts'
import { RenderService } from '../../render/renderService.ts'
import { VisualAttentionService } from '../../vision/visualAttentionService.ts'
import type { ConvertFigmaDto } from '../dto/convertFigmaDto.ts'
import { FigmaApiClient } from './figmaApiClient.ts'
import type { ConvertProgressReporter } from './figmaProgress.ts'
import type { AiEnhanceResult, CodegenResult, ConvertProgressStage, FigmaNodeRef } from '../types/figmaTypes.ts'
import { buildRenderableHtml } from './utils/buildRenderableHtml.ts'

const FIGMA_AI_LLM_TIMEOUT_MS = 1 * 60_000
const LOGGABLE_TAILWIND_FRAGMENT_MAX_LENGTH = 20_000
const FIGMA_AI_DEBUG_IMAGE_DIR = resolve(process.cwd(), '.debug', 'figma-ai-enhance')

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
    private readonly visualAttentionService: VisualAttentionService,
    private readonly loggingService: LoggingService,
  ) {}

  async enhance(input: {
    dto: ConvertFigmaDto
    nodeRef: FigmaNodeRef
    token: string
    codegenResult: CodegenResult
    convertProgress: ConvertProgressReporter
    abortSignal?: AbortSignal
  }): Promise<AiEnhanceResult> {
    const runId = randomUUID()
    const startedAt = Date.now()
    const events: AgentProgressEvent[] = []
    const stage = this.createAiEnhanceStageReporter(runId, input.convertProgress)
    // agent 日志
    const handleAgentProgress = (event: AgentProgressEvent) => {
      events.push(event)
      input.convertProgress.reportAgent(event)
      const status = String(event.details?.status ?? '')
      const payload = {
        runId,
        module: 'figma',
        source: 'agent',
        agentEvent: event.event,
        details: event.details,
      }
      if (status === 'error') {
        this.loggingService.error(`AI enhance agent ${event.event}`, payload)
        return
      }
      this.loggingService.info(`AI enhance agent ${event.event}`, payload)
    }

    try {
      const apiKey = env.model.apiKey.trim() || input.dto.aiOptions?.apiKey?.trim() || ''
      if (!apiKey) {
        throw new BadRequestException(formatUserError({ type: 'ai.model_api_key.missing' }))
      }
      if (!input.dto.aiOptions?.baseUrl?.trim()) {
        throw new BadRequestException(formatUserError({ type: 'ai.model_endpoint.missing' }))
      }
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
      const renderHtml = buildRenderableHtml(input.codegenResult)
      const { buffer } = await stage.run('render_current', () =>
        this.renderService.renderHtmlToImage({
          html: renderHtml,
          width: viewport.width,
          height: viewport.height,
          format: 'png',
          fullPage: false,
          deviceScaleFactor: 1,
        }),
      )
      const currentPngBase64 = buffer.toString('base64')
      const visualAttention = await stage.run('visual_attention', () =>
        this.visualAttentionService.buildAttention({
          runId,
          figmaPngBase64: baselinePngBase64,
          renderedPngBase64: currentPngBase64,
        }),
      )
      const debugImageDir = await this.writeDebugImages(runId, {
        baseline: baselinePngBase64,
        current: currentPngBase64,
        evidence: visualAttention.visualEvidencePngBase64,
      })
      this.loggingService.info('AI enhance debug images saved', {
        runId,
        module: 'figma',
        source: 'backend',
        debugImageDir,
      })

      const currentHtml = await (async () => {
        try {
          const htmlFragment = (input.codegenResult.body || input.codegenResult.html).trim()
          const tailwindFragment = (await convertHtmlCssToTailwind(htmlFragment, input.codegenResult.css)).trim()
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
            error: formatError(error),
            errorCause: formatErrorCause(error),
          })
          return (input.codegenResult.body || input.codegenResult.html).trim()
        }
      })()

      const result = await stage.run('agent_visual_repair', () =>
        runVisualRepair({
          visualEvidencePngBase64: visualAttention.visualEvidencePngBase64,
          html: currentHtml,
          model: aiOptions.model?.trim() || 'gemini-2.5-flash',
          apiKey,
          baseUrl: aiOptions.baseUrl.trim(),
          temperature: aiOptions.temperature ?? 0,
          timeout: FIGMA_AI_LLM_TIMEOUT_MS,
          onProgress: handleAgentProgress,
          abortSignal: input.abortSignal,
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
        error: formatError(error),
        errorCause: formatErrorCause(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return {
        meta: {
          enabled: true,
          status: 'failed',
          runId,
          error: formatError(error),
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
        if (stage === 'render_baseline' || stage === 'render_current') {
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
            error: formatError(error),
            errorCause: formatErrorCause(error),
            stack: error instanceof Error ? error.stack : undefined,
          })
          throw new Error(formatUserError({ type: 'ai.enhance_stage.failed', stage, runId, error }))
        }
      },
    }
  }

  private async writeDebugImages(
    runId: string,
    images: { baseline: string; current: string; evidence: string },
  ): Promise<string> {
    const outputDir = resolve(FIGMA_AI_DEBUG_IMAGE_DIR, runId)
    await mkdir(outputDir, { recursive: true })
    const writes = [
      writeFile(resolve(outputDir, 'baseline.png'), Buffer.from(images.baseline, 'base64')),
      writeFile(resolve(outputDir, 'current.png'), Buffer.from(images.current, 'base64')),
    ]
    writes.push(writeFile(resolve(outputDir, 'visual-evidence.png'), Buffer.from(images.evidence, 'base64')))
    await Promise.all(writes)
    return outputDir
  }

  private toLoggableTailwindFragment(fragment: string): string {
    if (fragment.length <= LOGGABLE_TAILWIND_FRAGMENT_MAX_LENGTH) return fragment
    return `${fragment.slice(0, LOGGABLE_TAILWIND_FRAGMENT_MAX_LENGTH)}...[truncated]`
  }

}
