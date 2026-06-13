import { betterAuth } from 'better-auth'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { env } from '../config/env.ts'

mkdirSync(dirname(env.auth.databasePath), { recursive: true })

const authDatabase = new DatabaseSync(env.auth.databasePath)
const socialProviders = {
  ...(env.auth.github.clientId && env.auth.github.clientSecret
    ? {
        github: {
          clientId: env.auth.github.clientId,
          clientSecret: env.auth.github.clientSecret,
        },
      }
    : {}),
  ...(env.auth.google.clientId && env.auth.google.clientSecret
    ? {
        google: {
          clientId: env.auth.google.clientId,
          clientSecret: env.auth.google.clientSecret,
        },
      }
    : {}),
}

export const auth = betterAuth({
  appName: 'Codify',
  baseURL: env.auth.baseUrl,
  basePath: '/api/auth',
  secret: env.auth.secret || undefined,
  database: authDatabase,
  trustedOrigins: env.auth.trustedOrigins,
  socialProviders,
})

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>
