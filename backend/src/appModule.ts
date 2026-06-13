import { Module } from '@nestjs/common'
import { AssetModule } from './assets/assetModule.ts'
import { AuthModule } from './auth/authModule.ts'
import { FigmaModule } from './figma/figmaModule.ts'
import { LoggingModule } from './logging/loggingModule.ts'
import { RenderModule } from './render/renderModule.ts'

@Module({
  imports: [LoggingModule, AuthModule, AssetModule, FigmaModule, RenderModule],
})
export class AppModule {}
