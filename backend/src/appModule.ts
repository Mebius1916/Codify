import { Module } from '@nestjs/common'
import { AssetModule } from './platform/assets/assetModule.ts'
import { AuthModule } from './platform/auth/authModule.ts'
import { LoggingModule } from './platform/logging/loggingModule.ts'
import { SettingsModule } from './platform/settings/settingsModule.ts'
import { FigmaModule } from './conversion/figma/figmaModule.ts'
import { RenderModule } from './conversion/render/renderModule.ts'

@Module({
  imports: [LoggingModule, AuthModule, SettingsModule, AssetModule, FigmaModule, RenderModule],
})
export class AppModule {}
