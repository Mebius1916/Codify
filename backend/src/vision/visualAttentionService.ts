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
        this.loggingService.info('Visual attention skipped because image sizes differ', {
          runId: input.runId,
          module: 'vision',
          source: 'backend',
          figmaWidth: figmaImage.width,
          figmaHeight: figmaImage.height,
          renderedWidth: renderedImage.width,
          renderedHeight: renderedImage.height,
        })
        return { visualEvidencePngBase64: input.figmaPngBase64 }
      }

      const [figmaFeatures, renderedFeatures] = await Promise.all([
        this.dinov2FeatureExtractorService.extractPatchFeatures(figmaImage),
        this.dinov2FeatureExtractorService.extractPatchFeatures(renderedImage),
      ])

      const diffMap = buildPatchDiffMap(figmaFeatures, renderedFeatures)
      if (!diffMap) {
        this.loggingService.info('Visual attention skipped because DINOv2 patch grids differ', {
          runId: input.runId,
          module: 'vision',
          source: 'backend',
          figmaGrid: `${figmaFeatures.gridWidth}x${figmaFeatures.gridHeight}`,
          renderedGrid: `${renderedFeatures.gridWidth}x${renderedFeatures.gridHeight}`,
        })
        return { visualEvidencePngBase64: input.figmaPngBase64 }
      }

      const regionMerge = mergePatchRegions(diffMap, {
        width: figmaImage.width,
        height: figmaImage.height,
      })
      const internalRegions = regionMerge.regions

      if (!internalRegions.length) {
        this.loggingService.info('Visual attention completed with no obvious structural regions', {
          runId: input.runId,
          module: 'vision',
          source: 'backend',
          width: figmaImage.width,
          height: figmaImage.height,
          figmaGrid: `${figmaFeatures.gridWidth}x${figmaFeatures.gridHeight}`,
          renderedGrid: `${renderedFeatures.gridWidth}x${renderedFeatures.gridHeight}`,
          hiddenSize: figmaFeatures.hiddenSize,
          patchGrid: `${diffMap.width}x${diffMap.height}`,
          patchCount: diffMap.distances.length,
          anomalousPatchCount: diffMap.anomalousPatches.length,
          medianDistance: Number(diffMap.medianDistance.toFixed(6)),
          madDistance: Number(diffMap.madDistance.toFixed(6)),
          hampelThreshold: Number(diffMap.hampelThreshold.toFixed(6)),
          percentileThreshold: Number(diffMap.percentileThreshold.toFixed(6)),
          threshold: Number(diffMap.threshold.toFixed(6)),
          minDistance: Number(diffMap.minDistance.toFixed(6)),
          maxDistance: Number(diffMap.maxDistance.toFixed(6)),
          initialRegionCount: regionMerge.initialRegionCount,
          filteredRegionCount: regionMerge.filteredRegionCount,
          finalRegionCount: internalRegions.length,
          minRegionPatchCount: regionMerge.minRegionPatchCount,
          minRegionArea: regionMerge.minRegionArea,
          minRegionFillRatio: regionMerge.minRegionFillRatio,
        })
        return { visualEvidencePngBase64: input.figmaPngBase64 }
      }

      const visualEvidencePngBase64 = buildVisualEvidenceSheet(figmaImage, internalRegions)
      this.loggingService.info('Visual attention completed', {
        runId: input.runId,
        module: 'vision',
        source: 'backend',
        width: figmaImage.width,
        height: figmaImage.height,
        figmaGrid: `${figmaFeatures.gridWidth}x${figmaFeatures.gridHeight}`,
        renderedGrid: `${renderedFeatures.gridWidth}x${renderedFeatures.gridHeight}`,
        hiddenSize: figmaFeatures.hiddenSize,
        patchGrid: `${diffMap.width}x${diffMap.height}`,
        patchCount: diffMap.distances.length,
        anomalousPatchCount: diffMap.anomalousPatches.length,
        medianDistance: Number(diffMap.medianDistance.toFixed(6)),
        madDistance: Number(diffMap.madDistance.toFixed(6)),
        hampelThreshold: Number(diffMap.hampelThreshold.toFixed(6)),
        percentileThreshold: Number(diffMap.percentileThreshold.toFixed(6)),
        threshold: Number(diffMap.threshold.toFixed(6)),
        minDistance: Number(diffMap.minDistance.toFixed(6)),
        maxDistance: Number(diffMap.maxDistance.toFixed(6)),
        initialRegionCount: regionMerge.initialRegionCount,
        filteredRegionCount: regionMerge.filteredRegionCount,
        finalRegionCount: internalRegions.length,
        minRegionPatchCount: regionMerge.minRegionPatchCount,
        minRegionArea: regionMerge.minRegionArea,
        minRegionFillRatio: regionMerge.minRegionFillRatio,
        regions: internalRegions.map((region) => ({
          id: region.id,
          bbox: region.bbox,
          diffScore: Number(region.diffScore.toFixed(6)),
        })),
      })

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
