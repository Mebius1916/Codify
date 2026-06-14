import { formatNetworkError, readResponseErrorMessage } from '@/utils/errorMessage'
import type { WorkspaceSettings } from '@/features/workspace/store/uiStore'

const backendUrl = import.meta.env.VITE_BACKEND_URL?.trim() || window.location.origin

export async function fetchWorkspaceSettings(): Promise<Partial<WorkspaceSettings> | null> {
  let response: Response

  try {
    response = await fetch(`${backendUrl}/api/settings/workspace`, {
      credentials: 'include',
    })
  } catch (error) {
    throw new Error(formatNetworkError('读取工作区设置失败', error))
  }

  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response, '读取工作区设置失败'))
  }

  return (await response.json()) as Partial<WorkspaceSettings> | null
}

export async function saveWorkspaceSettings(settings: WorkspaceSettings): Promise<WorkspaceSettings> {
  let response: Response

  try {
    response = await fetch(`${backendUrl}/api/settings/workspace`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(settings),
    })
  } catch (error) {
    throw new Error(formatNetworkError('保存工作区设置失败', error))
  }

  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response, '保存工作区设置失败'))
  }

  return (await response.json()) as WorkspaceSettings
}
