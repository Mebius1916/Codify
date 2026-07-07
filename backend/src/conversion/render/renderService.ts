import { BadRequestException, Injectable, type OnModuleDestroy } from '@nestjs/common'
import puppeteer, { type Browser, type Page } from 'puppeteer'
import { formatUserError } from '../../platform/errors/userErrorEvents.ts'
import type { RenderHtmlDto } from './renderController.ts'

export type RenderImageFormat = 'png' | 'jpeg' | 'webp'

interface RenderResult {
  buffer: Buffer
  format: RenderImageFormat
}

// 默认视口参数，避免 body 中未传时回退值散落在多处
const DEFAULT_VIEWPORT = {
  width: 1280,
  height: 800,
  deviceScaleFactor: 1,
}

const SUPPORTED_FORMATS: readonly RenderImageFormat[] = ['png', 'jpeg', 'webp']

// 单浏览器实例复用，避免每次请求冷启动造成的 ~1s 额外耗时
@Injectable()
export class RenderService implements OnModuleDestroy {
  private browserPromise: Promise<Browser> | null = null

  async renderHtmlToImage(input: RenderHtmlDto): Promise<RenderResult> {
    if (!input?.html || typeof input.html !== 'string' || !input.html.trim()) {
      throw new BadRequestException('请传入待渲染的 html 字符串')
    }

    const format = this.resolveFormat(input.format)
    const width = this.resolvePositiveInt(input.width, DEFAULT_VIEWPORT.width, 'width')
    const height = this.resolvePositiveInt(input.height, DEFAULT_VIEWPORT.height, 'height')
    const deviceScaleFactor = this.resolveScale(input.deviceScaleFactor)
    const fullPage = input.fullPage ?? true
    const omitBackground = input.omitBackground ?? false

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const browser = await this.getBrowser()
      let page: Page | undefined
      try {
        page = await browser.newPage()
        await page.setViewport({ width, height, deviceScaleFactor })
        // networkidle0 等待所有资源（图片/字体）加载完成，确保截图稳定
        await page.setContent(input.html, { waitUntil: 'networkidle0' })

        const screenshot = await page.screenshot({
          type: format,
          fullPage,
          omitBackground,
          encoding: 'binary',
        })

        return { buffer: Buffer.from(screenshot), format }
      } catch (error) {
        if (attempt === 0 && this.isBrowserConnectionError(error)) {
          await this.resetBrowser(browser)
          continue
        }
        throw new Error(formatUserError({ type: 'render.html.failed', error }))
      } finally {
        await page?.close().catch(() => undefined)
      }
    }
    throw new Error(formatUserError({ type: 'render.html.restart_failed' }))
  }

  async onModuleDestroy() {
    if (!this.browserPromise) return
    const browser = await this.browserPromise.catch(() => null)
    this.browserPromise = null
    if (browser) await browser.close().catch(() => undefined)
  }

  private async getBrowser(): Promise<Browser> {
    const existing = await this.browserPromise?.catch(() => null)
    if (existing && !existing.connected) {
      await this.resetBrowser(existing)
    }
    if (!this.browserPromise) {
      this.browserPromise = puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      }).catch((err) => {
        this.browserPromise = null
        throw err
      })
    }
    return this.browserPromise
  }

  private async resetBrowser(browser: Browser): Promise<void> {
    if (this.browserPromise) this.browserPromise = null
    await browser.close().catch(() => undefined)
  }

  private isBrowserConnectionError(error: unknown): boolean {
    if (!(error instanceof Error)) return false
    return error.message.includes('Connection closed') || error.message.includes('Target closed')
  }

  private resolveFormat(format: RenderHtmlDto['format']): RenderImageFormat {
    if (format == null) return 'png'
    if (!SUPPORTED_FORMATS.includes(format)) {
      throw new BadRequestException(`format 仅支持 ${SUPPORTED_FORMATS.join(' / ')}`)
    }
    return format
  }

  private resolvePositiveInt(value: number | undefined, fallback: number, field: string): number {
    if (value == null) return fallback
    if (!Number.isFinite(value) || value <= 0 || value > 8192) {
      throw new BadRequestException(`${field} 需在 (0, 8192] 范围内`)
    }
    return Math.floor(value)
  }

  private resolveScale(value: number | undefined): number {
    if (value == null) return DEFAULT_VIEWPORT.deviceScaleFactor
    if (!Number.isFinite(value) || value <= 0 || value > 4) {
      throw new BadRequestException('deviceScaleFactor 需在 (0, 4] 范围内')
    }
    return value
  }
}
