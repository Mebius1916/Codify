import { Body, Controller, Header, HttpCode, Post, StreamableFile } from '@nestjs/common'
import { Readable } from 'node:stream'
import { RenderService, type RenderImageFormat } from './renderService.ts'

export interface RenderHtmlDto {
  html: string
  width?: number
  height?: number
  format?: RenderImageFormat
  fullPage?: boolean
  deviceScaleFactor?: number
  omitBackground?: boolean
}

const FORMAT_TO_MIME: Record<RenderImageFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

@Controller('/api/render')
export class RenderController {
  constructor(private readonly renderService: RenderService) {}

  // 接收 HTML 字符串，返回渲染后的图片二进制
  @Post('/html')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async renderHtml(@Body() body: RenderHtmlDto) {
    const { buffer, format } = await this.renderService.renderHtmlToImage(body)
    // 使用 Nest 原生的 StreamableFile 避免直接依赖 express 类型
    return new StreamableFile(Readable.from(buffer), {
      type: FORMAT_TO_MIME[format],
      length: buffer.length,
    })
  }
}
