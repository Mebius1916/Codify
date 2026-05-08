import type { AlgorithmOptions } from '@codify/design2code'
import type { FigmaConvertResult } from '../interfaces/model'

interface ConvertFigmaOptions {
  figmaUrl: string
  token: string
  algorithmOptions?: Partial<AlgorithmOptions>
  aiEnhance?: boolean
  aiOptions?: {
    model: string
    apiKey: string
    baseUrl: string
  }
}

export async function convertFigma({
  figmaUrl,
  token,
  algorithmOptions,
  aiEnhance,
  aiOptions,
}: ConvertFigmaOptions): Promise<FigmaConvertResult> {
  const baseUrl = import.meta.env.VITE_BACKEND_URL?.trim();
  const resp = await fetch(`${baseUrl}/api/figma/convert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      figmaUrl,
      token,
      algorithmOptions,
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
  return payload as FigmaConvertResult
}
