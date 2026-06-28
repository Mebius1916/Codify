import 'dotenv/config'

interface EnvConfig {
  port: number
  frontendUrl: string
  auth: {
    baseUrl: string
    databasePath: string
    secret: string
    trustedOrigins: string[]
    github: {
      clientId: string
      clientSecret: string
    }
    google: {
      clientId: string
      clientSecret: string
    }
  }
  betterStack: {
    sourceToken: string
    ingestingHost: string
  }
  model: {
    apiKey: string
  }
  sourceInsight: {
    timeoutMs: number
  }
}

export const env: EnvConfig = {
  port: Number(process.env.PORT),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  auth: {
    baseUrl: process.env.BETTER_AUTH_URL ?? `http://localhost:${process.env.PORT ?? 8848}`,
    databasePath: process.env.AUTH_DATABASE_PATH ?? new URL('../../data/auth.sqlite', import.meta.url).pathname,
    secret: process.env.BETTER_AUTH_SECRET ?? '',
    trustedOrigins: [
      process.env.FRONTEND_URL ?? 'http://localhost:3000',
      ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ],
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    },
  },
  betterStack: {
    sourceToken: process.env.BETTER_STACK_SOURCE_TOKEN ?? '',
    ingestingHost: process.env.BETTER_STACK_INGESTING_HOST ?? '',
  },
  model: {
    apiKey: process.env.MODEL_API_KEY ?? '',
  },
  sourceInsight: {
    timeoutMs: Number(process.env.SOURCE_INSIGHT_TIMEOUT_MS ?? 2 * 60_000),
  },
}
