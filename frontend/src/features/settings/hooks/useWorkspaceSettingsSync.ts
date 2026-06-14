import { useEffect, useRef } from 'react'
import { authClient } from '@/features/auth/lib/authClient'
import { useUiStore } from '@/features/workspace/store/uiStore'
import { showToast } from '@/ui/appToast'
import { fetchWorkspaceSettings } from '../services/workspaceSettingsApi'

export function useWorkspaceSettingsSync() {
  const { data: session } = authClient.useSession()
  const loadedUserIdRef = useRef<string | null>(null)
  const applyWorkspaceSettings = useUiStore((state) => state.applyWorkspaceSettings)

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) {
      loadedUserIdRef.current = null
      return
    }

    if (loadedUserIdRef.current === userId) return
    loadedUserIdRef.current = userId

    let cancelled = false

    async function syncWorkspaceSettings() {
      try {
        const settings = await fetchWorkspaceSettings()
        if (cancelled || !settings) return
        applyWorkspaceSettings(settings)
      } catch (error) {
        if (cancelled) return
        const message = error instanceof Error ? error.message : '读取工作区设置失败'
        showToast({ title: '设置同步失败', message, variant: 'error' })
      }
    }

    void syncWorkspaceSettings()

    return () => {
      cancelled = true
    }
  }, [applyWorkspaceSettings, session?.user.id])
}
