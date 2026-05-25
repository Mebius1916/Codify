import { Body, Controller, Post, Res } from '@nestjs/common'
import type { ConvertFigmaDto } from '../dto/convertFigmaDto.ts'
import { FigmaService } from '../services/figmaService.ts'
import { CONVERT_PROGRESS_LABELS } from '../services/figmaProgress.ts'
import type { ConvertProgressEvent } from '../types/figmaTypes.ts'

interface NdjsonResponse {
  setHeader(name: string, value: string): void
  flushHeaders?: () => void
  write(chunk: string): void
  end(): void
}

type ConvertStreamEvent =
  | { type: ConvertProgressEvent['stage']; label: string }
  | { type: 'result'; data: Awaited<ReturnType<FigmaService['convert']>> }
  | { type: 'error'; message: string }

@Controller('/api/figma')
export class FigmaController {
  constructor(private readonly figmaService: FigmaService) {}

  @Post('/convert')
  async convert(@Body() body: ConvertFigmaDto, @Res() res: NdjsonResponse) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const writeEvent = (event: ConvertStreamEvent) => {
      res.write(`${JSON.stringify(event)}\n`)
    }

    try {
      const result = await this.figmaService.convert(body, (event) =>
        writeEvent({ type: event.stage, label: event.label }),
      )
      writeEvent({ type: 'completed', label: CONVERT_PROGRESS_LABELS.completed })
      writeEvent({ type: 'result', data: result })
    } catch (error) {
      writeEvent({
        type: 'failed',
        label: CONVERT_PROGRESS_LABELS.failed,
      })
      writeEvent({
        type: 'error',
        message: error instanceof Error ? error.message : String(error),
      })
    } finally {
      res.end()
    }
  }
}
