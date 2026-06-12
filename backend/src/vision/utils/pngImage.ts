import { PNG } from 'pngjs'

export interface RgbaImage {
  width: number
  height: number
  data: Buffer
}

export function decodePngBase64(base64: string): RgbaImage {
  const png = PNG.sync.read(Buffer.from(base64, 'base64'))
  return {
    width: png.width,
    height: png.height,
    data: Buffer.from(png.data),
  }
}

export function encodePngBase64(image: RgbaImage): string {
  const png = new PNG({ width: image.width, height: image.height })
  png.data = Buffer.from(image.data)
  return PNG.sync.write(png).toString('base64')
}
