import { BadRequestException, Injectable } from '@nestjs/common'
import type { ConvertFigmaDto } from '../dto/convertFigmaDto.ts'
import { FigmaAiEnhanceService } from './figmaAiEnhanceService.ts'
import { FigmaApiClient } from './figmaApiClient.ts'
import { FigmaCodegenService } from './figmaCodegenService.ts'

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

  convert(input: ConvertFigmaDto) {
    const task = this.convertQueue.then(() => this.runConvert(input))
    this.convertQueue = task.then(() => undefined, () => undefined)
    return task
  }

  private async runConvert(input: ConvertFigmaDto) {
    if (!input.figmaUrl?.trim()) throw new BadRequestException('请输入 figma url')
    if (!input.token?.trim()) throw new BadRequestException('请先填写 Figma Token')

    const token = input.token.trim()
    const nodeRef = this.figmaApiClient.parseFigmaUrl(input.figmaUrl)
    const figmaData = await this.figmaApiClient.fetchFigmaNode(nodeRef, token)
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
    })

    return {
      codegenResult,
      aiEnhancedResult: aiEnhanced.result,
      aiEnhanceMeta: aiEnhanced.meta,
    }
  }
}
