import type { RectSize } from '../interfaces/contracts'

const PREVIEW_FIT_PADDING_RATIO = 0.9

export function computeLayoutPayload(
  previewContentSize: RectSize | null | undefined,
  containerSize: RectSize,
) {
  if (!previewContentSize) return null

  const contentWidth = previewContentSize.width
  const contentHeight = previewContentSize.height
  const containerWidth = containerSize.width
  const containerHeight = containerSize.height

  if (contentWidth <= 0 || contentHeight <= 0) return null
  if (containerWidth <= 0 || containerHeight <= 0) return null

  const fitScale = Math.min(containerWidth / contentWidth, containerHeight / contentHeight)
  const scale = fitScale * PREVIEW_FIT_PADDING_RATIO
  return { scale, width: contentWidth, height: contentHeight }
}
