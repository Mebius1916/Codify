import { Module } from '@nestjs/common'
import { AssetModule } from './assets/assetModule.ts'
import { FigmaModule } from './figma/figmaModule.ts'
import { LoggingModule } from './logging/loggingModule.ts'
import { RenderModule } from './render/renderModule.ts'

@Module({
  imports: [LoggingModule, AssetModule, FigmaModule, RenderModule],
})
export class AppModule {}
