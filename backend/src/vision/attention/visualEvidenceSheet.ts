import type { BBox, InternalRegion } from '../interface/index.ts'
import type { RgbaImage } from '../utils/pngImage.ts'
import { encodePngBase64 } from '../utils/pngImage.ts'
import {
  createImage,
  drawScaledImage,
  expandBBox,
  fillRect,
  type RgbaColor,
  strokeOuterRect,
} from '../utils/rasterDraw.ts'

const BACKGROUND = [255, 255, 255, 255] as const
const PANEL_BORDER = [226, 232, 240, 255] as const
const REGION_COLORS = [
  [239, 68, 68, 255],
  [37, 99, 235, 255],
  [22, 163, 74, 255],
  [217, 119, 6, 255],
  [147, 51, 234, 255],
  [8, 145, 178, 255],
  [225, 29, 72, 255],
  [101, 163, 13, 255],
] as const
const SHEET_WIDTH = 1440 // 长图宽度
const SHEET_PADDING = 24 // 外边距
const SECTION_GAP = 24 // 图片间距
const PANEL_PADDING = 10 // region图内边距
const BORDER_WIDTH = 4 // region图边框
const AREA_SIMILAR_DELTA = 0.1 // 面积宽容度

interface EvidenceItem {
  region: InternalRegion
  color: RgbaColor
  cropBox: BBox
  cropWidth: number
  cropHeight: number
  scale: number
}

export function buildVisualEvidenceSheet(image: RgbaImage, regions: InternalRegion[]): string {
  const imageArea = image.width * image.height
  const evidenceRegions = [...regions].sort((left, right) => compareRegionPriority(left, right, imageArea))
  if (!evidenceRegions.length) return encodePngBase64(image)

  const contentWidth = SHEET_WIDTH - SHEET_PADDING * 2
  const overviewScale = Math.min(1, contentWidth / image.width)
  const overviewWidth = Math.max(1, Math.round(image.width * overviewScale))
  const overviewHeight = Math.max(1, Math.round(image.height * overviewScale))

  const items = evidenceRegions.map((region, index): EvidenceItem => {
    const color = REGION_COLORS[index % REGION_COLORS.length]
    const cropBox = expandBBox(region.bbox, image, 16)
    const cropWidth = cropBox[2] - cropBox[0]
    const cropHeight = cropBox[3] - cropBox[1]
    const maxCropWidth = contentWidth - PANEL_PADDING * 2 - BORDER_WIDTH * 2
    const scale = cropWidth * 2 <= maxCropWidth ? 2 : cropWidth <= maxCropWidth ? 1 : maxCropWidth / cropWidth
    return { region, color, cropBox, cropWidth, cropHeight, scale }
  })

  const cropPanelHeights = items.map((item) =>
    Math.round(item.cropHeight * item.scale) + PANEL_PADDING * 2 + BORDER_WIDTH * 2,
  )

  const sheetHeight =
    SHEET_PADDING +
    overviewHeight +
    SECTION_GAP +
    cropPanelHeights.reduce((total, height) => total + height + SECTION_GAP, 0) -
    SECTION_GAP +
    SHEET_PADDING

  const sheet = createImage(SHEET_WIDTH, sheetHeight, BACKGROUND)

  const overviewX = SHEET_PADDING + Math.floor((contentWidth - overviewWidth) / 2)
  const overviewY = SHEET_PADDING
  drawScaledImage(sheet, image, [0, 0, image.width, image.height], overviewX, overviewY, overviewScale)
  fillRect(sheet, overviewX, overviewY, overviewX + overviewWidth, overviewY + 1, PANEL_BORDER)
  fillRect(sheet, overviewX, overviewY + overviewHeight - 1, overviewX + overviewWidth, overviewY + overviewHeight, PANEL_BORDER)
  fillRect(sheet, overviewX, overviewY, overviewX + 1, overviewY + overviewHeight, PANEL_BORDER)
  fillRect(sheet, overviewX + overviewWidth - 1, overviewY, overviewX + overviewWidth, overviewY + overviewHeight, PANEL_BORDER)

  for (const item of items) {
    const [left, top, right, bottom] = item.region.bbox
    const outer: BBox = [
      overviewX + Math.round(left * overviewScale),
      overviewY + Math.round(top * overviewScale),
      overviewX + Math.round(right * overviewScale),
      overviewY + Math.round(bottom * overviewScale),
    ]
    strokeOuterRect(sheet, outer, item.color, BORDER_WIDTH)
  }

  let nextY = overviewY + overviewHeight + SECTION_GAP
  for (const item of items) {
    const cropDisplayWidth = Math.round(item.cropWidth * item.scale)
    const cropDisplayHeight = Math.round(item.cropHeight * item.scale)
    const panelWidth = cropDisplayWidth + PANEL_PADDING * 2 + BORDER_WIDTH * 2
    const panelHeight = cropDisplayHeight + PANEL_PADDING * 2 + BORDER_WIDTH * 2
    const panelX = SHEET_PADDING + Math.floor((contentWidth - panelWidth) / 2)

    fillRect(sheet, panelX, nextY, panelX + panelWidth, nextY + BORDER_WIDTH, item.color)
    fillRect(sheet, panelX, nextY + panelHeight - BORDER_WIDTH, panelX + panelWidth, nextY + panelHeight, item.color)
    fillRect(sheet, panelX, nextY, panelX + BORDER_WIDTH, nextY + panelHeight, item.color)
    fillRect(sheet, panelX + panelWidth - BORDER_WIDTH, nextY, panelX + panelWidth, nextY + panelHeight, item.color)
    const cropX = panelX + PANEL_PADDING + BORDER_WIDTH
    const cropY = nextY + PANEL_PADDING + BORDER_WIDTH
    drawScaledImage(sheet, image, item.cropBox, cropX, cropY, item.scale)
    nextY += panelHeight + SECTION_GAP
  }

  return encodePngBase64(sheet)
}

// regions排序规则
function compareRegionPriority(
  left: InternalRegion,
  right: InternalRegion,
  imageArea: number,
): number {
  const leftAreaRatio =
    (Math.max(0, left.bbox[2] - left.bbox[0]) * Math.max(0, left.bbox[3] - left.bbox[1])) / imageArea
  const rightAreaRatio =
    (Math.max(0, right.bbox[2] - right.bbox[0]) * Math.max(0, right.bbox[3] - right.bbox[1])) / imageArea
  const areaDeltaRatio =
    Math.abs(leftAreaRatio - rightAreaRatio) / Math.max(leftAreaRatio, rightAreaRatio, Number.EPSILON)

  if (areaDeltaRatio <= AREA_SIMILAR_DELTA) {
    return right.diffScore - left.diffScore
  }

  return rightAreaRatio - leftAreaRatio
}
