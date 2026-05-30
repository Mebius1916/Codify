import { useEffect } from 'react'
import { useEditorStore } from '@/features/workspace/store/editorStore'
import { useUiStore } from '@/features/workspace/store/uiStore'
import { Loading } from '@/ui/Loading'
import { useIframeScrollFocus } from '../hooks/useIframeScrollFocus'
import { usePreviewIframeLayout } from '../hooks/usePreviewIframeLayout'
import { useContainerSize } from '../hooks/useContainerSize'
import type { RectSize } from '../interfaces/contracts'
import { PREVIEW_SRC_DOC } from '../shell'
import { computeLayoutPayload } from '../utils/common'

interface PreviewPanelProps {
  previewContentSize?: RectSize | null
}

export function PreviewPanel({
  previewContentSize,
}: PreviewPanelProps) {
  const previewFiles = useEditorStore((state) => state.files)
  const setPreviewZoomPercent = useUiStore((state) => state.setPreviewZoomPercent)
  const { iframeRef, handleIframePointerDown, handleIframeClick } = useIframeScrollFocus()
  const { containerRef, containerSize } = useContainerSize<HTMLDivElement>()
  const layoutPayload = computeLayoutPayload(previewContentSize, containerSize)

  const { isFrameReady, isLayoutReady, zoomPercent } = usePreviewIframeLayout({
    iframeRef,
    previewSrcDoc: PREVIEW_SRC_DOC,
    layoutPayload,
    previewFiles,
  })

  useEffect(() => {
    setPreviewZoomPercent(zoomPercent)
  }, [zoomPercent, setPreviewZoomPercent])

  const isReady = isFrameReady && (!layoutPayload || isLayoutReady)

  return (
    <div className="flex flex-col h-full ">
      <div ref={containerRef} className="relative flex-1 w-full h-full overflow-hidden ">
        <iframe
          ref={iframeRef}
          srcDoc={PREVIEW_SRC_DOC}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '100%',
            height: '100%',
            border: 'none',
            background: 'rgb(12, 14, 23)',
          }}
          title="Preview"
          sandbox=" allow-same-origin allow-scripts"
          onPointerDown={handleIframePointerDown}
          onClick={handleIframeClick}
          tabIndex={0}
        />
        {!isReady && (
          <div className="absolute inset-0">
            <Loading className="bg-[rgb(12,14,23)] text-gray-400" text="加载预览内容..." />
          </div>
        )}
      </div>
    </div>
  )
}
