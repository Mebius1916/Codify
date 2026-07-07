import { Module } from '@nestjs/common'
import { RenderModule } from '../render/renderModule.ts'
import { SourceInsightModule } from '../../sourceInsight/insight/sourceInsightModule.ts'
import { VisionModule } from '../vision/visionModule.ts'
import { AiEnhanceService } from './aiEnhanceService.ts'

@Module({
  imports: [RenderModule, VisionModule, SourceInsightModule],
  providers: [AiEnhanceService],
  exports: [AiEnhanceService],
})
export class AiEnhanceModule {}

