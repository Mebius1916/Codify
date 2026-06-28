import { betterAuth } from 'better-auth'
import { env } from '../config/env.ts'
import { appDatabase } from '../database/appDatabase.ts'
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
  database: appDatabase,
  trustedOrigins: env.auth.trustedOrigins,
  socialProviders,
  account: {
    accountLinking: {
      updateUserInfoOnLink: true,
    },
  },
})

export type AuthSession = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>
