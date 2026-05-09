import { diffPng } from "./diffPng.js";

export interface RenderHtmlOptions {
  endpoint: string;
  html: string;
  width?: number;
  height?: number;
  format?: "png" | "jpeg" | "webp";
  fullPage?: boolean;
  deviceScaleFactor?: number;
  omitBackground?: boolean;
  timeoutMs?: number;
}

export interface RenderHtmlResult {
  base64: string;
  mime: string;
  byteLength: number;
}

// 渲染 HTML 并与 baseline 做像素级 diff 所需的入参
export interface RenderAndDiffOptions {
  endpoint: string;
  html: string;
  baselinePngBase64: string;
  viewportWidth: number;
  viewportHeight: number;
  diffThreshold: number;
  timeoutMs?: number;
}

// 渲染 + diff 的结构化结果，方便调用方按字段取用
export interface RenderAndDiffResult {
  currentPngBase64: string;
  diffPngBase64: string;
  diffRatio: number;
}

// 通过后端 /api/render/html 接口把 HTML 字符串渲染成 PNG base64
export async function renderHtmlToPngBase64(
  options: RenderHtmlOptions
): Promise<RenderHtmlResult> {
  if (!options.html?.trim()) {
    throw new Error("renderHtml 需要非空的 html 字符串");
  }

  const endpoint = normalizeEndpoint(options.endpoint);

  // AbortController 控制网络超时，默认 30s，足够 puppeteer 启动 + 渲染
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        html: options.html,
        width: options.width,
        height: options.height,
        format: options.format ?? "png",
        fullPage: options.fullPage,
        deviceScaleFactor: options.deviceScaleFactor,
        omitBackground: options.omitBackground,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(
        `renderHtml 调用失败：${resp.status} ${resp.statusText}${text ? ` - ${text}` : ""}`
      );
    }

    const mime = resp.headers.get("content-type") ?? "image/png";
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return {
      base64: buffer.toString("base64"),
      mime,
      byteLength: buffer.byteLength,
    };
  } finally {
    clearTimeout(timer);
  }
}

function normalizeEndpoint(endpoint: string): string {
  const trimmed = endpoint?.trim();
  if (!trimmed) {
    throw new Error("renderHtml 需要非空的 endpoint 地址");
  }
  return trimmed;
}


export async function renderAndDiffAgainstBaseline(
  options: RenderAndDiffOptions
): Promise<RenderAndDiffResult> {
  const rendered = await renderHtmlToPngBase64({
    endpoint: options.endpoint,
    html: options.html,
    width: options.viewportWidth,
    height: options.viewportHeight,
    fullPage: false,
    timeoutMs: options.timeoutMs,
  });

  // pixelmatch 对尺寸要求严格，因此 viewport 必须与 baseline 对齐；尺寸不一致会在 diffPng 内部抛错。
  const diff = diffPng(
    options.baselinePngBase64,
    rendered.base64,
    options.diffThreshold
  );

  return {
    currentPngBase64: rendered.base64,
    diffPngBase64: diff.diffBase64,
    diffRatio: diff.diffRatio,
  };
}
