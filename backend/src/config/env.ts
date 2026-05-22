import 'dotenv/config'

interface EnvConfig {
  port: number
  renderEndpoint: string
  betterStack: {
    sourceToken: string
    ingestingHost: string
  }
}

export const env: EnvConfig = {
  port: Number(process.env.PORT),
  renderEndpoint: process.env.RENDER_ENDPOINT ?? '',
  betterStack: {
    sourceToken: process.env.BETTER_STACK_SOURCE_TOKEN ?? '',
    ingestingHost: process.env.BETTER_STACK_INGESTING_HOST ?? '',
  },
}
