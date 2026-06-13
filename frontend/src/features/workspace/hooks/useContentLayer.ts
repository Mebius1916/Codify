import { useEffect, useState } from 'react'
import { createLocalForageContentRepository } from '@/features/workspace/repository/contentRepository'
import { setWorkspaceRoom } from '@/features/workspace/services/workspaceService'
import { useEditorStore } from '@/features/workspace/store/editorStore'

export function useContentLayer(roomId: string) {
  const [isContentReady, setIsContentReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsContentReady(false)
    setWorkspaceRoom(roomId)

    const run = async () => {
      const repo = createLocalForageContentRepository(roomId)
      const snapshot = await repo.loadAll()

      if (cancelled) return
      useEditorStore.getState().initializeFiles(snapshot.files)
      setIsContentReady(true)
    }

    run().catch(() => {
      if (!cancelled) setIsContentReady(true)
    })

    return () => {
      cancelled = true
    }
  }, [roomId])

  return { isContentReady }
}
