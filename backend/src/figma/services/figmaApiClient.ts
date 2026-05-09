import { BadRequestException, Injectable } from '@nestjs/common'
import LRUCache from 'lru-cache'
import type { FigmaNodeRef } from '../types/figmaTypes.ts'

const FIGMA_RENDER_PNG_CACHE_TTL_MS = 30 * 60 * 1000
const FIGMA_RENDER_PNG_CACHE_MAX = 100

interface FigmaApiResponse {
  body?: unknown
}

interface FigmaImagesResponse {
  images?: Record<string, string | null>
}

@Injectable()
export class FigmaApiClient {
  private readonly renderPngCache = new LRUCache<string, string>({
    max: FIGMA_RENDER_PNG_CACHE_MAX,
    ttl: FIGMA_RENDER_PNG_CACHE_TTL_MS,
  })

  parseFigmaUrl(figmaUrl: string): FigmaNodeRef {
    const parsed = new URL(figmaUrl)
    const pathMatch = parsed.pathname.match(/\/(?:file|design)\/([a-zA-Z0-9]+)/)
    if (!pathMatch) {
      throw new BadRequestException('无法从链接中提取 File Key，请检查链接格式')
    }
    const nodeId = parsed.searchParams.get('node-id')
    if (!nodeId) {
      throw new BadRequestException('链接中缺少 node-id 参数，请选中一个 Frame 后再复制链接')
    }
    return { fileKey: pathMatch[1], nodeId }
  }

  async fetchFigmaNode({ fileKey, nodeId }: FigmaNodeRef, token: string): Promise<unknown> {
    const figmaResp = await fetch(
      `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(this.normalizeNodeId(nodeId))}`,
      { headers: { 'X-Figma-Token': token } },
    )
    if (!figmaResp.ok) {
      throw new BadRequestException(`Failed to fetch Figma data: ${figmaResp.status} ${figmaResp.statusText}`)
    }

    const rawJson = await figmaResp.json() as unknown
    if (rawJson && typeof rawJson === 'object' && 'body' in (rawJson as FigmaApiResponse)) {
      const body = (rawJson as FigmaApiResponse).body
      if (typeof body === 'string') return JSON.parse(body) as unknown
      if (body && typeof body === 'object') return body
    }
    return rawJson
  }

  async fetchFigmaRenderPngBase64({ fileKey, nodeId }: FigmaNodeRef, token: string): Promise<string> {
    const normalizedNodeId = this.normalizeNodeId(nodeId)
    const cacheKey = `${fileKey}:${normalizedNodeId}:png:1`
    const cached = this.renderPngCache.get(cacheKey)
    if (cached) return cached

    const imagesResp = await fetch(
      `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(normalizedNodeId)}&format=png&scale=1`,
      { headers: { 'X-Figma-Token': token } },
    )
    if (!imagesResp.ok) {
      throw new BadRequestException(`Failed to export Figma image: ${imagesResp.status} ${imagesResp.statusText}`)
    }

    const payload = await imagesResp.json() as FigmaImagesResponse
    const imageUrl = payload.images?.[normalizedNodeId]
    if (!imageUrl) {
      throw new BadRequestException('Figma 图片导出失败：未返回图片地址')
    }

    const imageResp = await fetch(imageUrl)
    if (!imageResp.ok) {
      throw new BadRequestException(`Failed to download Figma image: ${imageResp.status} ${imageResp.statusText}`)
    }

    const base64 = Buffer.from(await imageResp.arrayBuffer()).toString('base64')
    this.renderPngCache.set(cacheKey, base64)
    return base64
  }

  private normalizeNodeId(nodeId: string): string {
    return nodeId.replace(/-/g, ':')
  }
}
