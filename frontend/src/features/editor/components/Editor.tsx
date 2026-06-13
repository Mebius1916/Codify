import { useEffect, useRef, useState } from 'react'
import type * as Monaco from 'monaco-editor'
import { useEditorStore } from '@/features/workspace/store/editorStore'
import { Loading } from '@/ui/Loading'
import { initMonaco } from '../utils/initMonaco'
import { EmptyState } from './common/EmptyState'
import { useMonacoBinding } from '../monacoBinding/useMonacoBinding'
import { MonacoEditorWrapper } from './features/MonacoEditorWrapper'
import { useContentLayer } from '@/features/workspace/hooks/useContentLayer'

interface EditorProps {
  roomId: string
}

export function Editor({ roomId }: EditorProps) {
  const activeFile = useEditorStore((state) => state.activeFile)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const editorDomRef = useRef<HTMLElement | null>(null)
  const [isEditorMounted, setIsEditorMounted] = useState(false)
  const [isMonacoReady, setIsMonacoReady] = useState(false)

  const { isContentReady } = useContentLayer(roomId)

  useEffect(() => {
    if (!activeFile) return
    if (isMonacoReady) return

    let cancelled = false
    initMonaco()
      .then(() => {
        if (!cancelled) setIsMonacoReady(true)
      })
      .catch(() => {
        if (!cancelled) setIsMonacoReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [activeFile, isMonacoReady])

  useMonacoBinding({
    editor: editorRef.current,
    activeFile,
    domReady: isEditorMounted,
  })

  useEffect(() => {
    const handleKeydownCapture = (e: KeyboardEvent) => {
      const dom = editorDomRef.current
      if (!dom) return

      const target = e.target
      if (!(target instanceof Node)) return
      if (!dom.contains(target)) return

      if (!/^F([1-9]|1[0-2])$/.test(e.key)) return

      e.stopImmediatePropagation()
      e.stopPropagation()
    }

    window.addEventListener('keydown', handleKeydownCapture, { capture: true })
    return () => {
      window.removeEventListener('keydown', handleKeydownCapture, { capture: true } as AddEventListenerOptions)
    }
  }, [])

  if (!isContentReady) {
    return <Loading text="正在加载文件..." />
  }

  if (!activeFile) {
    return <EmptyState />
  }

  const isLoading = !isMonacoReady || !isEditorMounted

  return (
    <>
      {isLoading && <Loading text="正在初始化编辑器..." />}
      <div style={{ display: isLoading ? 'none' : 'block', height: '100%' }}>
        {isMonacoReady && (
          <MonacoEditorWrapper
            activeFile={activeFile}
            onMount={(editor) => {
              editorRef.current = editor
              editorDomRef.current = editor.getDomNode()
              setIsEditorMounted(true)
            }}
          />
        )}
      </div>
    </>
  )
}
