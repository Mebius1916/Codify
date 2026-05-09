export interface ConvertFigmaDto {
  figmaUrl: string
  token: string
  aiEnhance?: boolean
  aiOptions?: {
    apiKey: string
    baseUrl: string
    model?: string
    temperature?: number
  }
}
