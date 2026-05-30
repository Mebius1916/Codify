import { useEffect, useRef, useState, type RefObject } from 'react'

type LayoutPayload = { scale: number; width: number; height: number } | null
type PreviewLayoutMessage =
  | { type: 'preview:ready'; payload?: { bootId?: string | null } }
  | { type: 'preview:layout:applied'; payload?: { bootId?: string | null } }
  | { type: 'preview:viewport'; payload?: { bootId?: string | null; zoomPercent?: number } }

interface PreviewIframeLayoutOptions {
  iframeRef: RefObject<HTMLIFrameElement | null>
  previewSrcDoc: string
  layoutPayload: LayoutPayload
  previewFiles: Record<string, string>
}

type PreviewCommand = 'zoom-in' | 'zoom-out' | 'reset' | 'fit'

function readLayoutMessage(data: unknown): PreviewLayoutMessage | null {
  if (!data || typeof data !== 'object') return null
  const message = data as {
    type?: unknown
    payload?: { bootId?: string | null; zoomPercent?: number }
  }
  if (message.type === 'preview:ready') {
    return { type: message.type, payload: message.payload }
  }
  if (message.type === 'preview:layout:applied') {
    return { type: message.type, payload: message.payload }
  }
  if (message.type === 'preview:viewport') {
    return { type: message.type, payload: message.payload }
  }
  return null
}

export function usePreviewIframeLayout({
  iframeRef,
  previewSrcDoc,
  layoutPayload,
  previewFiles,
}: PreviewIframeLayoutOptions) {
  const [isFrameReady, setIsFrameReady] = useState(false)
  const [isLayoutReady, setIsLayoutReady] = useState(false)
  const [zoomPercent, setZoomPercent] = useState(100)
  const readyRef = useRef(false) // 是否已经握手
  const bootIdRef = useRef<string | null>(null) // iframe 唯一标识
  const layoutPayloadRef = useRef<LayoutPayload>(layoutPayload) // 布局参数
  const previewFilesRef = useRef(previewFiles)

  layoutPayloadRef.current = layoutPayload
  previewFilesRef.current = previewFiles

  const postPreviewContent = () => {
    if (!readyRef.current) return
    iframeRef.current?.contentWindow?.postMessage?.(
      {
        type: 'preview:update',
        payload: {
          bootId: bootIdRef.current,
          html: previewFilesRef.current['src/index.html'] ?? '',
          resetCss: previewFilesRef.current['src/reset.css'] ?? '',
          styleCss: previewFilesRef.current['src/style.css'] ?? '',
        },
      },
      '*',
    )
  }

  const postLayout = () => {
    if (!readyRef.current) return
    const payload = layoutPayloadRef.current
    if (!payload) return
    iframeRef.current?.contentWindow?.postMessage?.(
      { type: 'preview:layout', payload: { ...payload, bootId: bootIdRef.current } },
      '*',
    )
  }

  const postCommand = (command: PreviewCommand) => {
    if (!readyRef.current) return
    iframeRef.current?.contentWindow?.postMessage?.(
      { type: 'preview:command', payload: { command, bootId: bootIdRef.current } },
      '*',
    )
  }

  useEffect(() => {
    setIsFrameReady(false)
    setIsLayoutReady(false)
    readyRef.current = false
    bootIdRef.current = null
  }, [previewSrcDoc])

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return
      const message = readLayoutMessage(event.data)
      if (!message) return

      if (message.type === 'preview:ready') {
        bootIdRef.current = message.payload?.bootId ?? null
        readyRef.current = true
        setIsFrameReady(true)
        postPreviewContent()
        postLayout()
        return
      }

      if (message.type === 'preview:layout:applied') {
        const bootId = message.payload?.bootId ?? null
        if (bootIdRef.current && bootId !== bootIdRef.current) return
        setIsLayoutReady(true)
        return
      }

      if (message.type === 'preview:viewport') {
        const bootId = message.payload?.bootId ?? null
        if (bootIdRef.current && bootId !== bootIdRef.current) return
        const nextZoom = message.payload?.zoomPercent
        if (typeof nextZoom === 'number' && Number.isFinite(nextZoom) && nextZoom > 0) {
          setZoomPercent(Math.round(nextZoom))
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [iframeRef])

  useEffect(() => {
    postPreviewContent()
  }, [previewSrcDoc, previewFiles])

  useEffect(() => {
    postLayout()
  }, [previewSrcDoc, layoutPayload])

  return { isFrameReady, isLayoutReady, zoomPercent, postCommand }
}
