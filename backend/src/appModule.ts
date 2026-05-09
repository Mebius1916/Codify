import { Module } from '@nestjs/common'
import { AssetModule } from './assets/assetModule.ts'
import { FigmaModule } from './figma/figmaModule.ts'
import { RenderModule } from './render/renderModule.ts'

@Module({
  imports: [AssetModule, FigmaModule, RenderModule],
})
export class AppModule {}
