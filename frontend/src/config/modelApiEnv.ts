export interface ModelApiEnvConfig {
  endpoint: string
  model: string
  locked: boolean
}

const endpoint = import.meta.env.MODEL_API?.trim() ?? ''
const model = import.meta.env.MODEL_NAME?.trim() ?? ''

export const modelApiEnvConfig: ModelApiEnvConfig = {
  endpoint,
  model: model || 'gpt-4o',
  locked: Boolean(endpoint || model),
}

export function applyModelApiEnvDefaults<T extends {
  modelApiEndpoint: string
  modelApiKey: string
  modelName: string
  aiEnhance: boolean
}>(state: T): T {
  if (!modelApiEnvConfig.locked) return state
  return {
    ...state,
    modelApiEndpoint: modelApiEnvConfig.endpoint,
    modelApiKey: 'Configured on server',
    modelName: modelApiEnvConfig.model,
    aiEnhance: true,
  }
}
