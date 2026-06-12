import 'dotenv/config'

interface EnvConfig {
  port: number
  betterStack: {
    sourceToken: string
    ingestingHost: string
  }
  model: {
    apiKey: string
  }
}

export const env: EnvConfig = {
  port: Number(process.env.PORT),
  betterStack: {
    sourceToken: process.env.BETTER_STACK_SOURCE_TOKEN ?? '',
    ingestingHost: process.env.BETTER_STACK_INGESTING_HOST ?? '',
  },
  model: {
    apiKey: process.env.MODEL_API_KEY ?? '',
  },
}
