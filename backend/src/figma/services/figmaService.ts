import { BadRequestException, Injectable } from '@nestjs/common'
import { AiEnhanceService } from '../../aiEnhance/aiEnhanceService.ts'
import { createConvertProgressReporter, type ConvertProgressReporter } from '../../conversion/convertProgress.ts'
import type { ConvertProgressEvent } from '../../conversion/types.ts'
import { upsertInstrumentationPackets } from '../../sourceInsight/instrumentationStore.ts'
import type { ConvertFigmaDto } from '../dto/convertFigmaDto.ts'
import { FigmaApiClient } from './figmaApiClient.ts'
import { FigmaCodegenService } from './figmaCodegenService.ts'

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
    private readonly aiEnhanceService: AiEnhanceService,
  ) {}

  convert(input: ConvertFigmaDto, onProgress?: ConvertProgressSink, abortSignal?: AbortSignal) {
    const convertProgress = createConvertProgressReporter(onProgress)
    const task = this.convertQueue.then(() => this.runConvert(input, convertProgress, abortSignal))
    this.convertQueue = task.then(() => undefined, () => undefined)
    return task
  }

  private async runConvert(
    input: ConvertFigmaDto,
    convertProgress: ConvertProgressReporter,
    abortSignal?: AbortSignal,
  ) {
    abortSignal?.throwIfAborted()
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
      collectInstrumentation: Boolean(input.aiEnhance),
    })

    if (!input.aiEnhance) {
      return { codegenResult }
    }

    // 仅在 aiEnhance 时采集，把算法决策 packets 按 fileKey+nodeId 落库供 source insight 读回
    if (codegenResult.instrumentation?.length) {
      upsertInstrumentationPackets(nodeRef, codegenResult.instrumentation)
    }

    const baselinePngBase64 = await this.figmaApiClient.fetchFigmaRenderPngBase64(
      nodeRef,
      token,
    )
    const aiEnhanced = await this.aiEnhanceService.enhance({
      dto: input,
      nodeRef,
      baselinePngBase64,
      codegenResult,
      convertProgress,
      abortSignal,
    })

    return {
      codegenResult,
      aiEnhancedResult: aiEnhanced.result,
      aiEnhanceMeta: aiEnhanced.meta,
    }
  }
}
