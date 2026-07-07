import { Module } from '@nestjs/common'
import { Dinov2FeatureExtractorService } from './dinov2/dinov2FeatureExtractor.ts'
import { VisualAttentionService } from './visualAttentionService.ts'

@Module({
  providers: [Dinov2FeatureExtractorService, VisualAttentionService],
  exports: [VisualAttentionService],
})
export class VisionModule {}
