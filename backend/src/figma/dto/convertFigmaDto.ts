import type { AlgorithmOptions } from '@codify/design2code'

export interface ConvertFigmaDto {
  figmaUrl: string
  token: string
  algorithmOptions?: Partial<AlgorithmOptions>
  aiEnhance?: boolean
  aiOptions?: {
    apiKey: string
    baseUrl: string
    model?: string
    temperature?: number
    targetSimilarity?: number
  }
}
