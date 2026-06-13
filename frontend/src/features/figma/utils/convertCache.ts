import { parseFigmaRoomUrl } from './figmaRoom'

interface ConvertCacheKeyInput {
  figmaUrl: string
  aiEnhance?: boolean
  aiOptions?: {
    model: string
    baseUrl: string
  }
}

export function createConvertResultCacheKey(input: ConvertCacheKeyInput): string {
  const { roomId } = parseFigmaRoomUrl(input.figmaUrl)

  return JSON.stringify({
    roomId,
    aiEnhance: Boolean(input.aiEnhance),
    model: input.aiEnhance ? input.aiOptions?.model.trim() : '',
    baseUrl: input.aiEnhance ? input.aiOptions?.baseUrl.trim() : '',
  })
}
