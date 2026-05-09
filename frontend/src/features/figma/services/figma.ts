import localforage from 'localforage'
import type { FigmaConvertResult } from '../interfaces/model'

const convertResultCache = localforage.createInstance({ name: 'figma-convert-result-cache' })

interface ConvertFigmaOptions {
  figmaUrl: string
  token: string
  aiEnhance?: boolean
  aiOptions?: {
    model: string
    apiKey: string
    baseUrl: string
  }
}

function createConvertResultCacheKey(input: ConvertFigmaOptions): string {
  return JSON.stringify({
    figmaUrl: input.figmaUrl.trim(),
    aiEnhance: Boolean(input.aiEnhance),
    model: input.aiEnhance ? input.aiOptions?.model.trim() : '',
    baseUrl: input.aiEnhance ? input.aiOptions?.baseUrl.trim() : '',
  })
}

export async function convertFigma({
  figmaUrl,
  token,
  aiEnhance,
  aiOptions,
}: ConvertFigmaOptions): Promise<FigmaConvertResult> {
  const cacheKey = createConvertResultCacheKey({ figmaUrl, token, aiEnhance, aiOptions })
  const cachedResult = await convertResultCache.getItem<string>(cacheKey)
  if (cachedResult) {
    return JSON.parse(cachedResult) as FigmaConvertResult
  }

  const baseUrl = import.meta.env.VITE_BACKEND_URL?.trim();
  const resp = await fetch(`${baseUrl}/api/figma/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      figmaUrl,
      token,
      aiEnhance,
      aiOptions: aiEnhance ? aiOptions : undefined,
    }),
  })

  const payload = await resp.json().catch(() => ({}))
  if (!resp.ok) {
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? payload.message
      : `Figma 转换失败: ${resp.status} ${resp.statusText}`
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message))
  }
  const result = payload as FigmaConvertResult
  if (result.aiEnhanceMeta?.status !== 'failed') {
    await convertResultCache.setItem(cacheKey, JSON.stringify(result))
  }
  return result
}
