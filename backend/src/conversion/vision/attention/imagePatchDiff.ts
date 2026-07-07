/*
  https://en.wikipedia.org/wiki/Hampel_test
  threshold = median + k * 1.4826 * MAD
*/

import type { DinoPatchFeatures } from '../dinov2/dinov2FeatureExtractor.ts'

const MAD_NORMAL_SCALE = 1.4826
const MAD_SIGMA_FACTOR = 3
const ANOMALOUS_PATCH_PERCENTILE = 0.75 //todo

export interface PatchDiff {
  index: number
  x: number
  y: number
  distance: number
}

export interface PatchDiffMap {
  width: number
  height: number
  distances: Float32Array
  medianDistance: number
  madDistance: number
  hampelThreshold: number
  percentileThreshold: number
  threshold: number
  minDistance: number
  maxDistance: number
  anomalousPatches: PatchDiff[]
}

// 计算差异值并排除异常值
export function buildPatchDiffMap(
  baseline: DinoPatchFeatures,
  rendered: DinoPatchFeatures,
): PatchDiffMap | undefined {
  if (
    baseline.gridWidth !== rendered.gridWidth ||
    baseline.gridHeight !== rendered.gridHeight ||
    baseline.hiddenSize !== rendered.hiddenSize
  ) {
    return undefined
  }

  const patchCount = baseline.gridWidth * baseline.gridHeight
  const distances = new Float32Array(patchCount)
  let minDistance = Number.POSITIVE_INFINITY
  let maxDistance = Number.NEGATIVE_INFINITY

  for (let patchIndex = 0; patchIndex < patchCount; patchIndex += 1) {
    const distance = cosineDistance(
      baseline.features,
      rendered.features,
      patchIndex * baseline.hiddenSize,
      patchIndex * rendered.hiddenSize,
      baseline.hiddenSize,
    )
    distances[patchIndex] = distance
    minDistance = Math.min(minDistance, distance)
    maxDistance = Math.max(maxDistance, distance)
  }

  const median = getMedian(distances)
  const absoluteDeviations = new Float32Array(patchCount)
  for (let index = 0; index < distances.length; index += 1) {
    absoluteDeviations[index] = Math.abs(distances[index] - median)
  }
  const mad = getMedian(absoluteDeviations)
  const hampelThreshold = median + MAD_SIGMA_FACTOR * MAD_NORMAL_SCALE * mad
  const percentileThreshold = getPercentile(distances, ANOMALOUS_PATCH_PERCENTILE)
  const threshold = Math.min(hampelThreshold, percentileThreshold)
  const anomalousPatches: PatchDiff[] = []

  for (let index = 0; index < distances.length; index += 1) {
    const distance = distances[index]
    if (distance <= threshold) continue
    anomalousPatches.push({
      index,
      x: index % baseline.gridWidth,
      y: Math.floor(index / baseline.gridWidth),
      distance,
    })
  }

  return {
    width: baseline.gridWidth,
    height: baseline.gridHeight,
    distances,
    medianDistance: median,
    madDistance: mad,
    hampelThreshold,
    percentileThreshold,
    threshold,
    minDistance,
    maxDistance,
    anomalousPatches,
  }
}

// 差向量异值计算：cosineDistance(A, B) = 1 - cosineSimilarity(A, B)，关注『特征方向是否相似』
function cosineDistance(
  left: Float32Array,
  right: Float32Array,
  leftOffset: number,
  rightOffset: number,
  length: number,
): number {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0

  for (let i = 0; i < length; i += 1) {
    const leftValue = left[leftOffset + i]
    const rightValue = right[rightOffset + i]
    dot += leftValue * rightValue
    leftNorm += leftValue * leftValue
    rightNorm += rightValue * rightValue
  }

  const denominator = Math.sqrt(leftNorm) * Math.sqrt(rightNorm)
  if (!denominator) return 0
  return 1 - dot / denominator
}

// 计算出中位数 median + MAD
function getMedian(values: Float32Array): number {
  const sorted = Array.from(values).sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[middle]
  return (sorted[middle - 1] + sorted[middle]) / 2
}

function getPercentile(values: Float32Array, percentile: number): number {
  const sorted = Array.from(values).sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * percentile)))
  return sorted[index]
}
