import { createLocalForageContentRepository, type ContentRepository, type FileContent } from '../repository/contentRepository'
import { useEditorStore } from '../store/editorStore'

let contentRepository: ContentRepository | null = null
let currentRoomId: string | null = null

export function setWorkspaceRoom(roomId: string) {
  const nextRoomId = roomId.trim()
  if (!nextRoomId) throw new Error('workspace roomId is required')
  if (nextRoomId === currentRoomId && contentRepository) return
  currentRoomId = nextRoomId
  contentRepository = createLocalForageContentRepository(currentRoomId)
}

const getRepository = () => {
  if (!currentRoomId) throw new Error('workspace roomId is not initialized')
  if (!contentRepository) contentRepository = createLocalForageContentRepository(currentRoomId)
  return contentRepository
}

export function openFile(path: string) {
  useEditorStore.getState().openFile(path)
}

export function closeFile(path: string) {
  useEditorStore.getState().closeFile(path)
}

export function setFileContent(path: string, content: FileContent) {
  useEditorStore.getState().updateFileContent(path, content)
  void getRepository().saveFile(path, content)
}

export function addFile(path: string, content: FileContent = '') {
  useEditorStore.getState().addFile(path, content)
  void getRepository().saveFile(path, content)
}

export function deleteFile(path: string) {
  useEditorStore.getState().deleteFile(path)
  void getRepository().deleteFile(path)
}

export function renameFile(oldPath: string, newPath: string) {
  const content = useEditorStore.getState().files[oldPath]
  useEditorStore.getState().renameFile(oldPath, newPath)
  if (typeof content === 'string') {
    void getRepository().renameFile(oldPath, newPath)
  }
}
