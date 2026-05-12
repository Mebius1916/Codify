import { zipSync, strToU8 } from 'fflate'

const ASSET_DOWNLOAD_CONCURRENCY = 4

interface DownloadAllFilesOptions {
  files: Record<string, string>
  fileKeys: string[]
  zipName?: string
}

interface DownloadedAsset {
  bytes: Uint8Array
  contentType: string
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

async function fetchAsset(url: string): Promise<DownloadedAsset> {
  const baseUrl = import.meta.env.VITE_BACKEND_URL?.trim()
  const response = await fetch(`${baseUrl}/api/assets/download-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  if (!response.ok) {
    throw new Error(`Failed to download asset: ${response.status} ${response.statusText}`)
  }
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType: response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream',
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  let nextIndex = 0
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex
      nextIndex += 1
      await worker(items[currentIndex], currentIndex)
    }
  })
  await Promise.all(runners)
}

async function rewriteRemoteImagesToAssets(html: string): Promise<{
  html: string
  assets: Record<string, Uint8Array>
}> {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const imageElements = Array.from(doc.querySelectorAll<HTMLImageElement>('img[src]'))
  const imageSrcs = Array.from(new Set(imageElements.map((img) => img.getAttribute('src') as string)))
  const assets: Record<string, Uint8Array> = {}
  const assetPathByUrl = new Map<string, string>()

  await mapWithConcurrency(
    imageSrcs,
    ASSET_DOWNLOAD_CONCURRENCY,
    async (url, index) => {
      const asset = await fetchAsset(url)
      const assetName = `image-${index + 1}.${getAssetExtension(asset.contentType)}`
      const zipPath = `assets/${assetName}`
      assets[zipPath] = asset.bytes
      assetPathByUrl.set(url, `../${zipPath}`)
    },
  )

  imageElements.forEach((img) => {
    img.setAttribute('src', assetPathByUrl.get(img.getAttribute('src') as string) as string)
  })
  return { html: `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`, assets }
}

export async function downloadAllFilesAsZip(args: DownloadAllFilesOptions) {
  const { files, fileKeys, zipName } = args
  const entries: Record<string, Uint8Array> = {}
  const htmlPath = 'src/index.html'
  const rewritten = await rewriteRemoteImagesToAssets(files[htmlPath])

  fileKeys.forEach((path) => {
    entries[path] = strToU8(path === htmlPath ? rewritten.html : files[path])
  })

  Object.entries(rewritten.assets).forEach(([path, content]) => {
    entries[path] = content
  })

  const zipped = zipSync(entries, { level: 0 })
  const blob = new Blob([new Uint8Array(zipped)], { type: 'application/zip' })
  triggerDownload(blob, zipName || 'downloadAll.zip')
}

function getAssetExtension(contentType: string): string {
  switch (contentType) {
    case 'image/svg+xml':
      return 'svg'
    case 'image/png':
      return 'png'
    case 'image/jpeg':
      return 'jpg'
    default:
      return 'bin'
  }
}