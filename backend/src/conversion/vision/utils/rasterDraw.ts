import type { BBox } from '../interface/index.ts'
import type { RgbaImage } from './pngImage.ts'

export type RgbaColor = readonly [number, number, number, number]

// 逐像素创建图片
export function createImage(width: number, height: number, color: RgbaColor): RgbaImage {
  const data = Buffer.alloc(width * height * 4)
  for (let index = 0; index < data.length; index += 4) {
    data[index] = color[0]
    data[index + 1] = color[1]
    data[index + 2] = color[2]
    data[index + 3] = color[3]
  }
  return { width, height, data }
}

// 选中一块区域画到目标画板上
export function drawScaledImage(
  target: RgbaImage,
  source: RgbaImage,
  sourceBox: BBox,
  targetX: number,
  targetY: number,
  scale: number,
): void {
  const sourceWidth = sourceBox[2] - sourceBox[0]
  const sourceHeight = sourceBox[3] - sourceBox[1]
  const targetWidth = Math.max(1, Math.round(sourceWidth * scale))
  const targetHeight = Math.max(1, Math.round(sourceHeight * scale))

  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(sourceBox[2] - 1, sourceBox[0] + Math.floor(x / scale))
      const sourceY = Math.min(sourceBox[3] - 1, sourceBox[1] + Math.floor(y / scale))
      const outputX = targetX + x
      const outputY = targetY + y
      if (outputX < 0 || outputY < 0 || outputX >= target.width || outputY >= target.height) continue

      const sourceIndex = (sourceY * source.width + sourceX) * 4
      const targetIndex = (outputY * target.width + outputX) * 4
      target.data[targetIndex] = source.data[sourceIndex]
      target.data[targetIndex + 1] = source.data[sourceIndex + 1]
      target.data[targetIndex + 2] = source.data[sourceIndex + 2]
      target.data[targetIndex + 3] = source.data[sourceIndex + 3]
    }
  }
}

// 画外扩边框
export function strokeOuterRect(
  image: RgbaImage,
  bbox: BBox,
  color: RgbaColor,
  width: number,
): void {
  const left = Math.max(0, bbox[0] - width)
  const top = Math.max(0, bbox[1] - width)
  const right = Math.min(image.width, bbox[2] + width)
  const bottom = Math.min(image.height, bbox[3] + width)

  fillRect(image, left, top, right, top + width, color)
  fillRect(image, left, bottom - width, right, bottom, color)
  fillRect(image, left, top, left + width, bottom, color)
  fillRect(image, right - width, top, right, bottom, color)
}

export function fillRect(
  image: RgbaImage,
  left: number,
  top: number,
  right: number,
  bottom: number,
  color: RgbaColor,
): void {
  const startX = Math.max(0, Math.floor(left))
  const startY = Math.max(0, Math.floor(top))
  const endX = Math.min(image.width, Math.ceil(right))
  const endY = Math.min(image.height, Math.ceil(bottom))

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = (y * image.width + x) * 4
      image.data[index] = color[0]
      image.data[index + 1] = color[1]
      image.data[index + 2] = color[2]
      image.data[index + 3] = color[3]
    }
  }
}

// 多裁切一部分，扩充上下文
export function expandBBox(bbox: BBox, imageSize: { width: number; height: number }, padding: number): BBox {
  return [
    Math.max(0, Math.floor(bbox[0] - padding)),
    Math.max(0, Math.floor(bbox[1] - padding)),
    Math.min(imageSize.width, Math.ceil(bbox[2] + padding)),
    Math.min(imageSize.height, Math.ceil(bbox[3] + padding)),
  ]
}

export function areBBoxesNear(left: BBox, right: BBox, maxGap: number): boolean {
  const horizontalGap = Math.max(0, Math.max(left[0], right[0]) - Math.min(left[2], right[2]))
  const verticalGap = Math.max(0, Math.max(left[1], right[1]) - Math.min(left[3], right[3]))
  return horizontalGap <= maxGap && verticalGap <= maxGap
}

export function mergeBBoxes(left: BBox, right: BBox): BBox {
  return [
    Math.min(left[0], right[0]),
    Math.min(left[1], right[1]),
    Math.max(left[2], right[2]),
    Math.max(left[3], right[3]),
  ]
}
