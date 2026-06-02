import pixelmatch from 'pixelmatch'
import { PNG } from 'pngjs'

export function diffPng(baselineBase64: string, currentBase64: string, threshold: number) {
  const baseline = PNG.sync.read(Buffer.from(baselineBase64, 'base64'))
  const current = PNG.sync.read(Buffer.from(currentBase64, 'base64'))

  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `图片尺寸不一致：baseline=${baseline.width}x${baseline.height} current=${current.width}x${current.height}`,
    )
  }

  const diff = new PNG({ width: baseline.width, height: baseline.height })
  const diffPixels = pixelmatch(baseline.data, current.data, diff.data, baseline.width, baseline.height, {
    threshold,
    includeAA: true,
  })

  const totalPixels = baseline.width * baseline.height
  return {
    diffRatio: diffPixels / totalPixels,
    diffBase64: PNG.sync.write(diff).toString('base64'),
  }
}
