import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { fromNodeHeaders } from 'better-auth/node'
import type { IncomingHttpHeaders, IncomingMessage } from 'node:http'
import { auth, type AuthSession } from './auth.ts'

export interface AuthenticatedRequest extends IncomingMessage {
  headers: IncomingHttpHeaders
  authSession?: AuthSession
}

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>()
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    })

    if (!session) {
      throw new UnauthorizedException('请先登录后再继续操作')
    }

    request.authSession = session
    return true
  }
}
