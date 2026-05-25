interface ConvertCacheKeyInput {
  figmaUrl: string
  aiEnhance?: boolean
  aiOptions?: {
    model: string
    baseUrl: string
  }
}

export function createConvertResultCacheKey(input: ConvertCacheKeyInput): string {
  return JSON.stringify({
    figmaUrl: input.figmaUrl.trim(),
    aiEnhance: Boolean(input.aiEnhance),
    model: input.aiEnhance ? input.aiOptions?.model.trim() : '',
    baseUrl: input.aiEnhance ? input.aiOptions?.baseUrl.trim() : '',
  })
}
