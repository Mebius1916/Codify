import localforage from 'localforage'
import type { ConvertStageEvent, FigmaConvertResult } from '../interfaces/model'
import { createConvertResultCacheKey } from '../utils/convertCache'
import { readConvertStream } from '../utils/convertStream'

const convertResultCache = localforage.createInstance({ name: 'figma-convert-result-cache' })

interface ConvertFigmaOptions {
  figmaUrl: string
  token: string
  aiEnhance?: boolean
  onStage?: (event: ConvertStageEvent) => void
  aiOptions?: {
    model: string
    apiKey: string
    baseUrl: string
  }
}

export async function convertFigma({
  figmaUrl,
  token,
  aiEnhance,
  onStage,
  aiOptions,
}: ConvertFigmaOptions): Promise<FigmaConvertResult> {
  const cacheKey = createConvertResultCacheKey({ figmaUrl, aiEnhance, aiOptions })
  const cachedResult = await convertResultCache.getItem<string>(cacheKey)
  if (cachedResult) {
    onStage?.({ stage: 'completed', label: '已读取转换缓存' })
    return JSON.parse(cachedResult) as FigmaConvertResult
  }

  const baseUrl = import.meta.env.VITE_BACKEND_URL?.trim();
  const resp = await fetch(`${baseUrl}/api/figma/convert`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/x-ndjson',
    },
    body: JSON.stringify({
      figmaUrl,
      token,
      aiEnhance,
      aiOptions: aiEnhance ? aiOptions : undefined,
    }),
  })

  if (!resp.ok) {
    throw new Error(`Figma 转换失败: ${resp.status} ${resp.statusText}`)
  }

  const result = await readConvertStream(resp, onStage)
  if (result.aiEnhanceMeta?.status !== 'failed') {
    await convertResultCache.setItem(cacheKey, JSON.stringify(result))
  }
  return result
}
