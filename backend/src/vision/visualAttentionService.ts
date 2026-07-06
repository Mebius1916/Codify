import { Injectable } from '@nestjs/common'
import { formatError, formatErrorCause } from '../logging/loggingUtils.ts'
import { LoggingService } from '../logging/loggingService.ts'
import { buildPatchDiffMap } from './attention/imagePatchDiff.ts'
import { mergePatchRegions } from './attention/regionMerge.ts'
import { buildVisualEvidenceSheet } from './attention/visualEvidenceSheet.ts'
import { Dinov2FeatureExtractorService } from './dinov2/dinov2FeatureExtractor.ts'
import { decodePngBase64 } from './utils/pngImage.ts'

@Injectable()
export class VisualAttentionService {
  constructor(
    private readonly dinov2FeatureExtractorService: Dinov2FeatureExtractorService,
    private readonly loggingService: LoggingService,
  ) {}

  async buildAttention(input: {
    figmaPngBase64: string
    renderedPngBase64: string
    runId?: string
  }): Promise<{
    visualEvidencePngBase64: string
  }> {
    try {
      const figmaImage = decodePngBase64(input.figmaPngBase64)
      const renderedImage = decodePngBase64(input.renderedPngBase64)

      if (figmaImage.width !== renderedImage.width || figmaImage.height !== renderedImage.height) {
        return { visualEvidencePngBase64: input.figmaPngBase64 }
      }

      const [figmaFeatures, renderedFeatures] = await Promise.all([
        this.dinov2FeatureExtractorService.extractPatchFeatures(figmaImage),
        this.dinov2FeatureExtractorService.extractPatchFeatures(renderedImage),
      ])

      const diffMap = buildPatchDiffMap(figmaFeatures, renderedFeatures)
      if (!diffMap) {
        return { visualEvidencePngBase64: input.figmaPngBase64 }
      }

      const regionMerge = mergePatchRegions(diffMap, {
        width: figmaImage.width,
        height: figmaImage.height,
      })
      const internalRegions = regionMerge.regions

      if (!internalRegions.length) {
        return { visualEvidencePngBase64: input.figmaPngBase64 }
      }

      const visualEvidencePngBase64 = buildVisualEvidenceSheet(figmaImage, internalRegions)

      return {
        visualEvidencePngBase64,
      }
    } catch (error) {
      this.loggingService.error('Visual attention failed, using baseline as evidence', {
        runId: input.runId,
        module: 'vision',
        source: 'backend',
        error: formatError(error),
        errorCause: formatErrorCause(error),
        stack: error instanceof Error ? error.stack : undefined,
      })
      return { visualEvidencePngBase64: input.figmaPngBase64 }
    }
  }
}
