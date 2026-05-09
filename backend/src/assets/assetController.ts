import { Body, Controller, Header, HttpCode, Post, StreamableFile } from '@nestjs/common'
import { Readable } from 'node:stream'

interface DownloadImageDto {
  url: string
}

@Controller('/api/assets')
export class AssetController {
  @Post('/download-image')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async downloadImage(@Body() body: DownloadImageDto) {
    const response = await fetch(body.url)
    if (!response.ok) {
      throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    return new StreamableFile(Readable.from(buffer), {
      type: 'image/png',
      length: buffer.length,
    })
  }
}
