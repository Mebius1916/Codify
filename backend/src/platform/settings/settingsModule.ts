import { Module } from '@nestjs/common'
import { WorkspaceSettingsController } from './workspaceSettingsController.ts'
import { WorkspaceSettingsService } from './workspaceSettingsService.ts'

@Module({
  controllers: [WorkspaceSettingsController],
  providers: [WorkspaceSettingsService],
})
export class SettingsModule {}
