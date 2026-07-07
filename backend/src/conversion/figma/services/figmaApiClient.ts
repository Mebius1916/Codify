import { BadRequestException, Injectable } from '@nestjs/common'
import LRUCache from 'lru-cache'
import { formatUserError, type FigmaApiStep } from '../../../platform/errors/userErrorEvents.ts'
import type { FigmaNodeRef } from '../../shared/types.ts'

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
    let parsed: URL
    try {
      parsed = new URL(figmaUrl)
    } catch {
      throw new BadRequestException(formatUserError({ type: 'figma.url.invalid' }))
    }
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
    const figmaResp = await this.fetchFigmaApi(
      'fetch_node',
      `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${encodeURIComponent(this.normalizeNodeId(nodeId))}`,
      { headers: { 'X-Figma-Token': token } },
    )
    if (!figmaResp.ok) {
      throw new BadRequestException(
        formatUserError({
          type: 'figma.api.response',
          step: 'fetch_node',
          responseSummary: await this.formatFailedResponse(figmaResp),
        }),
      )
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

    const imagesResp = await this.fetchFigmaApi(
      'export_image',
      `https://api.figma.com/v1/images/${fileKey}?ids=${encodeURIComponent(normalizedNodeId)}&format=png&scale=1`,
      { headers: { 'X-Figma-Token': token } },
    )
    if (!imagesResp.ok) {
      throw new BadRequestException(
        formatUserError({
          type: 'figma.api.response',
          step: 'export_image',
          responseSummary: await this.formatFailedResponse(imagesResp),
        }),
      )
    }

    const payload = await imagesResp.json() as FigmaImagesResponse
    const imageUrl = payload.images?.[normalizedNodeId]
    if (!imageUrl) {
      throw new BadRequestException(formatUserError({ type: 'figma.image.missing', nodeId: normalizedNodeId }))
    }

    const imageResp = await this.fetchFigmaApi('download_image', imageUrl)
    if (!imageResp.ok) {
      throw new BadRequestException(
        formatUserError({
          type: 'figma.api.response',
          step: 'download_image',
          responseSummary: await this.formatFailedResponse(imageResp),
        }),
      )
    }

    const base64 = Buffer.from(await imageResp.arrayBuffer()).toString('base64')
    this.renderPngCache.set(cacheKey, base64)
    return base64
  }

  private normalizeNodeId(nodeId: string): string {
    return nodeId.replace(/-/g, ':')
  }

  private async fetchFigmaApi(step: FigmaApiStep, url: string, init?: RequestInit): Promise<Response> {
    try {
      return await fetch(url, init)
    } catch (error) {
      throw new BadRequestException(
        formatUserError({ type: 'figma.api.network', step, error }),
      )
    }
  }

  private async formatFailedResponse(response: Response): Promise<string> {
    const body = await response.text().catch(() => '')
    const trimmedBody = body.trim()
    const detail = this.readShortResponseDetail(trimmedBody)
    return [
      `状态码：${response.status} ${response.statusText}`,
      detail,
    ].filter(Boolean).join('。')
  }

  private readShortResponseDetail(body: string): string | undefined {
    if (!body) return undefined
    try {
      const payload = JSON.parse(body) as { message?: unknown; error?: unknown; status?: unknown }
      const message = Array.isArray(payload.message) ? payload.message.join('；') : payload.message
      if (typeof message === 'string' && message.trim()) return `详情：${message.trim()}`
      if (typeof payload.error === 'string' && payload.error.trim()) return `详情：${payload.error.trim()}`
      if (typeof payload.status === 'string' && payload.status.trim()) return `详情：${payload.status.trim()}`
    } catch {
      if (body.length <= 240) return `详情：${body}`
    }
    return undefined
  }

}
