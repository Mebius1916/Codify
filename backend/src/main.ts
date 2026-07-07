import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { toNodeHandler } from 'better-auth/node'
import { json } from 'express'
import { AppModule } from './appModule.ts'
import { auth } from './platform/auth/auth.ts'
import { runAuthMigrations } from './platform/auth/authMigrations.ts'
import { env } from './platform/config/env.ts'

async function bootstrap() {
  await runAuthMigrations()

  const app = await NestFactory.create(AppModule, { bodyParser: false })
  const expressApp = app.getHttpAdapter().getInstance()

  app.enableCors({
    origin: env.auth.trustedOrigins,
    credentials: true,
  })

  expressApp.all('/api/auth/*', toNodeHandler(auth))
  expressApp.use(json({ limit: '10mb' }))
  await app.listen(env.port)
}

void bootstrap()
