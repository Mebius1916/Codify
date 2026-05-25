import { BadRequestException, Injectable } from '@nestjs/common'
import type { ConvertFigmaDto } from '../dto/convertFigmaDto.ts'
import { FigmaAiEnhanceService } from './figmaAiEnhanceService.ts'
import { FigmaApiClient } from './figmaApiClient.ts'
import { FigmaCodegenService } from './figmaCodegenService.ts'
import { createConvertProgressReporter, type ConvertProgressReporter } from './figmaProgress.ts'
import type { ConvertProgressEvent } from '../types/figmaTypes.ts'

type ConvertProgressSink = (event: ConvertProgressEvent) => void

@Injectable()
export class FigmaService {
  private convertQueue = Promise.resolve()

  constructor(
    // 解析 figma url
    private readonly figmaApiClient: FigmaApiClient,
    // 转换算法
    private readonly figmaCodegenService: FigmaCodegenService,
    // ai 增强
    private readonly figmaAiEnhanceService: FigmaAiEnhanceService,
  ) {}

  convert(input: ConvertFigmaDto, onProgress?: ConvertProgressSink) {
    const convertProgress = createConvertProgressReporter(onProgress)
    const task = this.convertQueue.then(() => this.runConvert(input, convertProgress))
    this.convertQueue = task.then(() => undefined, () => undefined)
    return task
  }

  private async runConvert(input: ConvertFigmaDto, convertProgress: ConvertProgressReporter) {
    if (!input.figmaUrl?.trim()) throw new BadRequestException('请输入 figma url')
    if (!input.token?.trim()) throw new BadRequestException('请先填写 Figma Token')

    const token = input.token.trim()
    const nodeRef = this.figmaApiClient.parseFigmaUrl(input.figmaUrl)
    convertProgress.report('figma_fetch')
    const figmaData = await this.figmaApiClient.fetchFigmaNode(nodeRef, token)
    convertProgress.report('codegen')
    const codegenResult = await this.figmaCodegenService.generate({
      figmaData,
      nodeRef,
      token,
    })

    if (!input.aiEnhance) {
      return { codegenResult }
    }

    const aiEnhanced = await this.figmaAiEnhanceService.enhance({
      dto: input,
      nodeRef,
      token,
      codegenResult,
      convertProgress,
    })

    return {
      codegenResult,
      aiEnhancedResult: aiEnhanced.result,
      aiEnhanceMeta: aiEnhanced.meta,
    }
  }
}
