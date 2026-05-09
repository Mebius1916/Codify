import { BadRequestException, Injectable } from '@nestjs/common'
import { convertFigmaToCode } from '@codify/design2code'
import LRUCache from 'lru-cache'
import type { CodegenResult, FigmaNodeRef } from '../types/figmaTypes.ts'

const FIGMA_ASSET_URL_CACHE_TTL_MS = 30 * 60 * 1000
const FIGMA_ASSET_URL_CACHE_MAX = 500

@Injectable()
export class FigmaCodegenService {
  private readonly assetUrlCache = new LRUCache<string, string>({
    max: FIGMA_ASSET_URL_CACHE_MAX,
    ttl: FIGMA_ASSET_URL_CACHE_TTL_MS,
  })

  async generate(input: {
    figmaData: unknown
    nodeRef: FigmaNodeRef
    token: string
  }): Promise<CodegenResult> {
    try {
      const result = await convertFigmaToCode(
        input.figmaData as Parameters<typeof convertFigmaToCode>[0],
        {
          fileKey: input.nodeRef.fileKey,
          token: input.token,
          scale: 1,
          format: 'png',
          fetcher: this.createAssetUrlCacheFetcher(input.nodeRef.fileKey),
        },
      )
      return { html: result.html, body: result.body, css: result.css, size: result.size }
    } catch {
      throw new BadRequestException('Figma 转换失败')
    }
  }

  private createAssetUrlCacheFetcher(fileKey: string) {
    return {
      resolveCache: async (key: string) => {
        return this.assetUrlCache.get(`${fileKey}:${key}`)
      },
      image: async (url: string, key: string) => {
        this.assetUrlCache.set(`${fileKey}:${key}`, url)
        return url
      },
    }
  }
}
