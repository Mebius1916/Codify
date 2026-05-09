import { Body, Controller, HttpException, Post, Res } from '@nestjs/common'
import type { ConvertFigmaDto } from '../dto/convertFigmaDto.ts'
import { FigmaService } from '../services/figmaService.ts'

interface StreamResponse {
  setHeader(name: string, value: string): void
  flushHeaders?: () => void
  write(chunk: string): void
  end(): void
}

@Controller('/api/figma')
export class FigmaController {
  constructor(private readonly figmaService: FigmaService) {}

  @Post('/convert')
  convert(@Body() body: ConvertFigmaDto) {
    return this.figmaService.convert(body)
  }

  @Post('/convert/stream')
  async convertStream(@Body() body: ConvertFigmaDto, @Res() res: StreamResponse) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    const write = (event: Record<string, unknown>) => {
      res.write(`${JSON.stringify(event)}\n`)
    }

    write({ type: 'status', message: 'queued' })

    try {
      const result = await this.figmaService.convert(body, {
        onAgentLog: (entry) => write({ type: 'agent-log', log: entry }),
      })
      write({ type: 'result', result })
    } catch (error) {
      write({ type: 'error', error: this.formatError(error) })
    } finally {
      res.end()
    }
  }

  private formatError(error: unknown): string {
    if (error instanceof HttpException) {
      const response = error.getResponse()
      if (typeof response === 'string') return response
      if (response && typeof response === 'object' && 'message' in response) {
        const message = (response as { message?: unknown }).message
        return Array.isArray(message) ? message.join(', ') : String(message)
      }
    }
    if (error instanceof Error) return error.message
    return String(error)
  }
}
