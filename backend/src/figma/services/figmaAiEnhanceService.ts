import { BadRequestException, Injectable } from '@nestjs/common'
import { visualDiff } from '@codify/agent'
import { env } from '../../config/env.ts'
import { RenderService } from '../../render/renderService.ts'
import type { ConvertFigmaDto } from '../dto/convertFigmaDto.ts'
import { FigmaApiClient } from './figmaApiClient.ts'
import type { AiEnhanceResult, CodegenResult, FigmaNodeRef } from '../types/figmaTypes.ts'

@Injectable()
export class FigmaAiEnhanceService {
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

      const viewport = this.resolveViewport(input.codegenResult)
      const baselinePngBase64 = await this.figmaApiClient.fetchFigmaRenderPngBase64(input.nodeRef, input.token)
      const currentHtml = this.buildRenderableHtml(input.codegenResult)
      const { buffer } = await this.renderService.renderHtmlToImage({
        html: currentHtml,
        width: viewport.width,
        height: viewport.height,
        format: 'png',
        fullPage: true,
        deviceScaleFactor: 1,
      })

      const result = await visualDiff({
        baselinePngBase64,
        currentPngBase64: buffer.toString('base64'),
        html: currentHtml,
        model: input.dto.aiOptions.model?.trim() || 'gpt-4o',
        apiKey: input.dto.aiOptions.apiKey.trim(),
        baseUrl: input.dto.aiOptions.baseUrl.trim(),
        temperature: input.dto.aiOptions.temperature ?? 0,
        threshold: 0.1,
        renderEndpoint: `http://localhost:${env.port}/api/render/html`,
        targetSimilarity: input.dto.aiOptions.targetSimilarity,
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
      })

      return {
        result,
        meta: { enabled: true, status: 'done' },
      }
    } catch (error) {
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

  private resolveViewport(result: CodegenResult): { width: number; height: number } {
    const width = result.size?.width
    const height = result.size?.height
    if (width && height) return { width, height }
    return { width: 1280, height: 800 }
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
  }
}
