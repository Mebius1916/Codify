import type { PatchDiffMap } from './imagePatchDiff.ts'
import type { InternalRegion, BBox } from '../interface/index.ts'
import { mergeBBoxes } from '../utils/rasterDraw.ts'

const MIN_REGION_PATCH_COUNT = 3
const MIN_REGION_AREA = 1 * 1
// 阈值可低不可高，阈值的作用是减少冗余数据
const MIN_REGION_FILL_RATIO = 0.2

interface MutableRegion {
  bbox: BBox
  patchBBox: BBox
  diffScore: number
  patchCount: number
}

export interface PatchRegionMergeResult {
  regions: InternalRegion[]
  initialRegionCount: number
  filteredRegionCount: number
  minRegionPatchCount: number
  minRegionArea: number
  minRegionFillRatio: number
}

class UnionFind {
  private readonly parents: number[]

  constructor(size: number) {
    this.parents = Array.from({ length: size }, (_, index) => index)
  }

  find(index: number): number {
    const parent = this.parents[index]
    if (parent === index) return index
    const root = this.find(parent)
    this.parents[index] = root
    return root
  }

  union(left: number, right: number): void {
    const leftRoot = this.find(left)
    const rightRoot = this.find(right)
    if (leftRoot !== rightRoot) {
      this.parents[rightRoot] = leftRoot
    }
  }
}

export function mergePatchRegions(
  diffMap: PatchDiffMap,
  imageSize: { width: number; height: number },
): PatchRegionMergeResult {
  if (!diffMap.anomalousPatches.length) {
    return {
      regions: [],
      initialRegionCount: 0,
      filteredRegionCount: 0,
      minRegionPatchCount: MIN_REGION_PATCH_COUNT,
      minRegionArea: MIN_REGION_AREA,
      minRegionFillRatio: MIN_REGION_FILL_RATIO,
    }
  }

  const anomalousIndexByPatchIndex = new Map<number, number>()
  diffMap.anomalousPatches.forEach((patch, index) => {
    anomalousIndexByPatchIndex.set(patch.index, index)
  })

  const unionFind = new UnionFind(diffMap.anomalousPatches.length)
  for (const patch of diffMap.anomalousPatches) {
    const current = anomalousIndexByPatchIndex.get(patch.index)
    if (current === undefined) continue
    for (const neighbor of getNeighborPatchIndexes(patch.x, patch.y, diffMap.width, diffMap.height)) {
      const neighborIndex = anomalousIndexByPatchIndex.get(neighbor)
      if (neighborIndex !== undefined) unionFind.union(current, neighborIndex)
    }
  }

  const patchWidth = imageSize.width / diffMap.width
  const patchHeight = imageSize.height / diffMap.height
  const grouped = new Map<number, MutableRegion>()

  for (let index = 0; index < diffMap.anomalousPatches.length; index += 1) {
    const patch = diffMap.anomalousPatches[index]
    const root = unionFind.find(index)
    const bbox: BBox = [
      Math.floor(patch.x * patchWidth),
      Math.floor(patch.y * patchHeight),
      Math.ceil((patch.x + 1) * patchWidth),
      Math.ceil((patch.y + 1) * patchHeight),
    ]
    const patchBBox: BBox = [patch.x, patch.y, patch.x + 1, patch.y + 1]
    const existing = grouped.get(root)
    if (!existing) {
      grouped.set(root, {
        bbox,
        patchBBox,
        diffScore: patch.distance,
        patchCount: 1,
      })
      continue
    }
    existing.bbox = mergeBBoxes(existing.bbox, bbox)
    existing.patchBBox = mergeBBoxes(existing.patchBBox, patchBBox)
    existing.diffScore += patch.distance
    existing.patchCount += 1
  }

  const initialRegions = [...grouped.values()]
    .map((region) => ({
      ...region,
      diffScore: region.diffScore / region.patchCount,
    }))

  const regions = initialRegions
    .filter(isRegionLargeEnough)
    .sort((left, right) => right.diffScore - left.diffScore)
    .map((region, index) => ({
        id: `R${index + 1}`,
        bbox: region.bbox,
        diffScore: region.diffScore,
    }))

  return {
    regions,
    initialRegionCount: initialRegions.length,
    filteredRegionCount: initialRegions.length - regions.length,
    minRegionPatchCount: MIN_REGION_PATCH_COUNT,
    minRegionArea: MIN_REGION_AREA,
    minRegionFillRatio: MIN_REGION_FILL_RATIO,
  }
}

// 返回邻居的坐标
function getNeighborPatchIndexes(x: number, y: number, width: number, height: number): number[] {
  const indexes: number[] = []
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      if (offsetX === 0 && offsetY === 0) continue
      const neighborX = x + offsetX
      const neighborY = y + offsetY
      if (neighborX < 0 || neighborY < 0 || neighborX >= width || neighborY >= height) continue
      indexes.push(neighborY * width + neighborX)
    }
  }
  return indexes
}

function isRegionLargeEnough(region: MutableRegion): boolean {
  const area = Math.max(0, region.bbox[2] - region.bbox[0]) * Math.max(0, region.bbox[3] - region.bbox[1])
  const patchArea =
    Math.max(0, region.patchBBox[2] - region.patchBBox[0]) * Math.max(0, region.patchBBox[3] - region.patchBBox[1])
  const fillRatio = patchArea > 0 ? region.patchCount / patchArea : 0
  return region.patchCount >= MIN_REGION_PATCH_COUNT && area >= MIN_REGION_AREA && fillRatio >= MIN_REGION_FILL_RATIO
}
