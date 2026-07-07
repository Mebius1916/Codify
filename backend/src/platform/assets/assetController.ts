import {
  BadRequestException,
  Body,
  Controller,
  Header,
  HttpCode,
  Logger,
  Post,
  ServiceUnavailableException,
  StreamableFile,
  UseGuards,
} from '@nestjs/common'
import { Readable } from 'node:stream'
import { AuthGuard } from '../auth/authGuard.ts'
import { formatError } from '../logging/loggingUtils.ts'

interface DownloadImageDto {
  url: string
}

@Controller('/api/assets')
export class AssetController {
  private readonly logger = new Logger(AssetController.name)

  @Post('/download-image')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  @UseGuards(AuthGuard)
  async downloadImage(@Body() body: DownloadImageDto) {
    let parsedUrl: URL
    try {
      parsedUrl = new URL(body.url)
    } catch {
      throw new BadRequestException('图片下载失败：资源 URL 无效')
    }

    let response: Response
    try {
      response = await fetch(parsedUrl)
    } catch (error) {
      const message = formatError(error)
      this.logger.error(`Asset download request failed: host=${parsedUrl.host} message=${message}`)
      throw new ServiceUnavailableException(`图片下载失败：无法访问远程资源 (${message})`)
    }

    if (!response.ok) {
      this.logger.warn(`Asset download returned non-ok response: host=${parsedUrl.host} status=${response.status} ${response.statusText}`)
      throw new BadRequestException(`图片下载失败：${response.status} ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') || 'application/octet-stream'
    return new StreamableFile(Readable.from(buffer), {
      type: contentType,
      length: buffer.length,
    })
  }
}
