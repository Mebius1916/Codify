import { Module } from '@nestjs/common'
import { AiEnhanceModule } from '../aiEnhance/aiEnhanceModule.ts'
import { FigmaController } from './controllers/figmaController.ts'
import { FigmaApiClient } from './services/figmaApiClient.ts'
import { FigmaCodegenService } from './services/figmaCodegenService.ts'
import { FigmaService } from './services/figmaService.ts'

@Module({
  imports: [AiEnhanceModule],
  controllers: [FigmaController],
  providers: [FigmaService, FigmaApiClient, FigmaCodegenService],
})
export class FigmaModule {}
