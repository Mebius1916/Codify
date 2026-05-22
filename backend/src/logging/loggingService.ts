import { Injectable, type OnApplicationShutdown } from '@nestjs/common'
import { Logtail } from '@logtail/node'
import { env } from '../config/env.ts'

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogContext = Record<string, unknown>

function normalizeEndpoint(host: string): string {
  const trimmed = host.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

@Injectable()
export class LoggingService implements OnApplicationShutdown {
  private readonly logtail: Logtail

  constructor() {
    const sourceToken = env.betterStack.sourceToken.trim()
    const endpoint = normalizeEndpoint(env.betterStack.ingestingHost)

    if (!sourceToken || !endpoint) {
      throw new Error('Better Stack logging requires BETTER_STACK_SOURCE_TOKEN and BETTER_STACK_INGESTING_HOST')
    }

    this.logtail = new Logtail(sourceToken, {
      endpoint,
      captureStackContext: false,
    })
  }

  debug(message: string, context?: LogContext) {
    this.write('debug', message, context)
  }

  info(message: string, context?: LogContext) {
    this.write('info', message, context)
  }

  warn(message: string, context?: LogContext) {
    this.write('warn', message, context)
  }

  error(message: string, context?: LogContext) {
    this.write('error', message, context)
  }

  async onApplicationShutdown() {
    await this.logtail.flush()
  }

  private write(level: LogLevel, message: string, context: LogContext = {}) {
    void this.logtail.log(message, level, {
      service: 'codify-backend',
      environment: process.env.NODE_ENV ?? 'development',
      ...context,
    })
  }
}
