import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common'
import { AuthGuard, type AuthenticatedRequest } from '../auth/authGuard.ts'
import type { WorkspaceSettingsDto } from './dto/workspaceSettingsDto.ts'
import { WorkspaceSettingsService } from './workspaceSettingsService.ts'

@Controller('/api/settings')
@UseGuards(AuthGuard)
export class WorkspaceSettingsController {
  constructor(private readonly workspaceSettingsService: WorkspaceSettingsService) {}

  @Get('/workspace')
  getWorkspaceSettings(@Req() request: AuthenticatedRequest) {
    const userId = request.authSession?.user.id
    if (!userId) return null
    return this.workspaceSettingsService.getSettings(userId)
  }

  @Put('/workspace')
  saveWorkspaceSettings(
    @Req() request: AuthenticatedRequest,
    @Body() body: WorkspaceSettingsDto,
  ) {
    const userId = request.authSession?.user.id
    if (!userId) return null
    return this.workspaceSettingsService.saveSettings(userId, body)
  }
}
