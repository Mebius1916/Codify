export function formatUnknownError(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (typeof error === 'string' && error.trim()) return error.trim()
  return fallback
}

export function formatNetworkError(context: string, error: unknown): string {
  const detail = formatUnknownError(error, '浏览器未返回具体错误')
  return `${context}：无法连接后端。请检查服务、地址或代理。原始错误：${detail}`
}

export async function readResponseErrorMessage(resp: Response, context: string): Promise<string> {
  const fallback = `${context}：后端返回 ${resp.status} ${resp.statusText || 'Unknown error'}`
  const body = await resp.text().catch(() => '')
  const trimmedBody = body.trim()
  if (!trimmedBody) return fallback

  try {
    const payload = JSON.parse(trimmedBody) as { message?: unknown; error?: unknown }
    const message = Array.isArray(payload.message) ? payload.message.join('；') : payload.message
    if (typeof message === 'string' && message.trim()) {
      return `${context}：${message.trim()}`
    }
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return `${context}：${payload.error.trim()}`
    }
  } catch {
    if (trimmedBody.length <= 240) return `${context}：${trimmedBody}`
    return fallback
  }

  return fallback
}
