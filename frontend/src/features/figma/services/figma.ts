import localforage from 'localforage'
import type { FigmaConvertResult } from '../interfaces/model'

const convertResultCache = localforage.createInstance({ name: 'figma-convert-result-cache' })

export interface ConvertFigmaLogEntry {
  timestamp: string
  level: 'info' | 'error'
  event: string
  details?: Record<string, unknown>
  message?: string
}

interface ConvertFigmaOptions {
  figmaUrl: string
  token: string
  aiEnhance?: boolean
  aiOptions?: {
    model: string
    apiKey: string
    baseUrl: string
  }
  onLog?: (entry: ConvertFigmaLogEntry) => void
}

function createConvertResultCacheKey(input: ConvertFigmaOptions): string {
  return JSON.stringify({
    figmaUrl: input.figmaUrl.trim(),
    aiEnhance: Boolean(input.aiEnhance),
    model: input.aiEnhance ? input.aiOptions?.model.trim() : '',
    baseUrl: input.aiEnhance ? input.aiOptions?.baseUrl.trim() : '',
  })
}

function createClientLog(event: string, message?: string): ConvertFigmaLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level: 'info',
    event,
    message,
  }
}

async function readConvertStream(resp: Response, onLog?: (entry: ConvertFigmaLogEntry) => void): Promise<FigmaConvertResult> {
  if (!resp.body) {
    throw new Error('当前浏览器不支持流式读取转换结果')
  }

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let result: FigmaConvertResult | undefined

  const handleLine = (line: string) => {
    if (!line.trim()) return
    const event = JSON.parse(line) as {
      type?: string
      message?: string
      error?: string
      log?: ConvertFigmaLogEntry
      result?: FigmaConvertResult
    }

    if (event.type === 'status') {
      onLog?.(createClientLog('backend:status', event.message))
      return
    }
    if (event.type === 'agent-log' && event.log) {
      onLog?.(event.log)
      return
    }
    if (event.type === 'error') {
      throw new Error(event.error || 'Figma 转换失败')
    }
    if (event.type === 'result' && event.result) {
      result = event.result
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) handleLine(line)
    if (done) break
  }

  if (buffer.trim()) handleLine(buffer)
  if (!result) throw new Error('Figma 转换失败：未收到转换结果')
  return result
}

export async function convertFigma({
  figmaUrl,
  token,
  aiEnhance,
  aiOptions,
  onLog,
}: ConvertFigmaOptions): Promise<FigmaConvertResult> {
  const cacheKey = createConvertResultCacheKey({ figmaUrl, token, aiEnhance, aiOptions })
  const cachedResult = await convertResultCache.getItem<string>(cacheKey)
  if (cachedResult) {
    onLog?.(createClientLog('cache:hit', '使用本地缓存结果'))
    return JSON.parse(cachedResult) as FigmaConvertResult
  }

  const baseUrl = import.meta.env.VITE_BACKEND_URL?.trim();
  const endpoint = aiEnhance ? '/api/figma/convert/stream' : '/api/figma/convert'
  const resp = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      figmaUrl,
      token,
      aiEnhance,
      aiOptions: aiEnhance ? aiOptions : undefined,
    }),
  })

  if (!resp.ok) {
    const payload = await resp.json().catch(() => ({}))
    const message = payload && typeof payload === 'object' && 'message' in payload
      ? payload.message
      : `Figma 转换失败: ${resp.status} ${resp.statusText}`
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message))
  }
  const result = aiEnhance
    ? await readConvertStream(resp, onLog)
    : await resp.json() as FigmaConvertResult
  if (result.aiEnhanceMeta?.status !== 'failed') {
    await convertResultCache.setItem(cacheKey, JSON.stringify(result))
  }
  return result
}
