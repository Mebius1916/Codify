import { Module } from '@nestjs/common'
import { RenderModule } from '../render/renderModule.ts'
import { VisionModule } from '../vision/visionModule.ts'
import { FigmaController } from './controllers/figmaController.ts'
import { FigmaAiEnhanceService } from './services/figmaAiEnhanceService.ts'
import { FigmaApiClient } from './services/figmaApiClient.ts'
import { FigmaCodegenService } from './services/figmaCodegenService.ts'
import { FigmaService } from './services/figmaService.ts'

@Module({
  imports: [RenderModule, VisionModule],
  controllers: [FigmaController],
  providers: [FigmaService, FigmaApiClient, FigmaCodegenService, FigmaAiEnhanceService],
})
export class FigmaModule {}
