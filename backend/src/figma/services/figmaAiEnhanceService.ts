import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { visualDiff } from '@codify/agent'
import { env } from '../../config/env.ts'
import { RenderService } from '../../render/renderService.ts'
import type { ConvertFigmaDto } from '../dto/convertFigmaDto.ts'
import { FigmaApiClient } from './figmaApiClient.ts'
import type { AiEnhanceResult, CodegenResult, FigmaNodeRef } from '../types/figmaTypes.ts'

const FIGMA_AI_ENHANCE_TIMEOUT_MS = 3 * 60_000

function readPngSize(base64: string): { width: number; height: number } {
  const buffer = Buffer.from(base64, 'base64')
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  }
}

@Injectable()
export class FigmaAiEnhanceService {
  private readonly logger = new Logger(FigmaAiEnhanceService.name)

  constructor(
    private readonly figmaApiClient: FigmaApiClient,
    private readonly renderService: RenderService,
  ) {}

  async enhance(input: {
    dto: ConvertFigmaDto
    nodeRef: FigmaNodeRef
    token: string
    codegenResult: CodegenResult
  }): Promise<AiEnhanceResult> {
    try {
      if (!input.dto.aiOptions?.apiKey?.trim()) throw new BadRequestException('AI enhance 缺少 apiKey')

      this.logger.log(`AI enhance started: model=${input.dto.aiOptions.model?.trim() || 'gpt-4o'} baseUrl=${input.dto.aiOptions.baseUrl.trim()}`)
      const baselinePngBase64 = await this.figmaApiClient.fetchFigmaRenderPngBase64(input.nodeRef, input.token)
      const viewport = readPngSize(baselinePngBase64)
      this.logger.log(`AI enhance baseline image fetched: viewport=${viewport.width}x${viewport.height}`)
      const currentHtml = this.buildRenderableHtml(input.codegenResult)
      const { buffer } = await this.renderService.renderHtmlToImage({
        html: currentHtml,
        width: viewport.width,
        height: viewport.height,
        format: 'png',
        fullPage: false,
        deviceScaleFactor: 1,
      })
      this.logger.log('AI enhance current HTML rendered')

      const abortController = new AbortController()
      const result = await this.withTimeout(
        visualDiff({
          baselinePngBase64,
          currentPngBase64: buffer.toString('base64'),
          html: currentHtml,
          model: input.dto.aiOptions.model?.trim() || 'gpt-4o',
          apiKey: input.dto.aiOptions.apiKey.trim(),
          baseUrl: input.dto.aiOptions.baseUrl.trim(),
          temperature: input.dto.aiOptions.temperature ?? 0,
          threshold: 0.1,
          renderEndpoint: env.renderEndpoint,
          targetSimilarity: 0.9,
          viewportWidth: viewport.width,
          viewportHeight: viewport.height,
          onProgress: (event) => {
            this.logger.log(`AI enhance agent ${event.event}${event.details ? ` ${JSON.stringify(event.details)}` : ''}`)
          },
          abortSignal: abortController.signal,
        }),
        FIGMA_AI_ENHANCE_TIMEOUT_MS,
        'AI enhance 超时，请检查模型接口是否可用或稍后重试',
        () => abortController.abort(),
      )

      this.logger.log('AI enhance completed')
      return {
        result,
        meta: { enabled: true, status: 'done' },
      }
    } catch (error) {
      this.logger.error(`AI enhance failed: ${this.formatError(error)}`)
      return {
        meta: {
          enabled: true,
          status: 'failed',
          error: this.formatError(error),
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
