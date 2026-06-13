import localforage from 'localforage'
import type { ConvertStageEvent, FigmaConvertResult } from '../interfaces/model'
import { createConvertResultCacheKey } from '../utils/convertCache'
import { readConvertStream } from '../utils/convertStream'
import { formatNetworkError, readResponseErrorMessage } from '@/utils/errorMessage'

const convertResultCache = localforage.createInstance({ name: 'figma-convert-result-cache' })

interface ConvertFigmaOptions {
  figmaUrl: string
  token: string
  aiEnhance?: boolean
  useConvertCache?: boolean
  onStage?: (event: ConvertStageEvent) => void
  aiOptions?: {
    model: string
    baseUrl: string
  }
}

export async function convertFigma({
  figmaUrl,
  token,
  aiEnhance,
  useConvertCache = true,
  onStage,
  aiOptions,
}: ConvertFigmaOptions): Promise<FigmaConvertResult> {
  const cacheKey = createConvertResultCacheKey({ figmaUrl, aiEnhance, aiOptions })
  if (useConvertCache) {
    const cachedResult = await convertResultCache.getItem<string>(cacheKey)
    if (cachedResult) {
      onStage?.({ stage: 'completed', label: '已读取转换缓存' })
      return JSON.parse(cachedResult) as FigmaConvertResult
    }
  }

  const baseUrl = import.meta.env.VITE_BACKEND_URL?.trim();
  let resp: Response
  try {
    resp = await fetch(`${baseUrl}/api/figma/convert`, {
      method: 'POST',
      credentials: 'include',
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
  } catch (error) {
    throw new Error(formatNetworkError('Figma 转换失败', error))
  }

  if (!resp.ok) {
    throw new Error(await readResponseErrorMessage(resp, 'Figma 转换失败'))
  }

  const result = await readConvertStream(resp, onStage)
  if (useConvertCache && result.aiEnhanceMeta?.status !== 'failed') {
    await convertResultCache.setItem(cacheKey, JSON.stringify(result))
  }
  return result
}
