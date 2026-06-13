import localforage from 'localforage'

export type FileContent = string

export interface ContentSnapshot {
  files: Record<string, FileContent>
  fileKeys: string[]
}

export interface ContentRepository {
  loadAll: () => Promise<ContentSnapshot>
  saveFile: (path: string, content: FileContent) => Promise<void>
  deleteFile: (path: string) => Promise<void>
  renameFile: (oldPath: string, newPath: string) => Promise<void>
  replaceAll: (files: Record<string, FileContent>) => Promise<void>
}

const INDEX_KEY = '__index__'
const makeFileKey = (path: string) => `file:${path}`

export function createLocalForageContentRepository(roomId: string): ContentRepository {
  const store = localforage.createInstance({ name: `codeflow-content:${roomId}` })

  const loadIndex = async (): Promise<string[]> => {
    const raw = await store.getItem<unknown>(INDEX_KEY)
    if (!Array.isArray(raw)) return []
    return raw.filter((v): v is string => typeof v === 'string')
  }

  const saveIndex = async (fileKeys: string[]) => {
    await store.setItem(INDEX_KEY, fileKeys)
  }

  const loadAll = async () => {
    const fileKeys = await loadIndex()
    const files: Record<string, FileContent> = {}
    await Promise.all(
      fileKeys.map(async (path) => {
        const value = await store.getItem<FileContent>(makeFileKey(path))
        if (typeof value === 'string') {
          files[path] = value
        }
      }),
    )
    return { files, fileKeys }
  }

  const saveFile = async (path: string, content: FileContent) => {
    await store.setItem(makeFileKey(path), content)
    const fileKeys = await loadIndex()
    if (!fileKeys.includes(path)) {
      await saveIndex([...fileKeys, path])
    }
  }

  const deleteFile = async (path: string) => {
    await store.removeItem(makeFileKey(path))
    const fileKeys = await loadIndex()
    if (fileKeys.includes(path)) {
      await saveIndex(fileKeys.filter((k) => k !== path))
    }
  }

  const renameFile = async (oldPath: string, newPath: string) => {
    const oldKey = makeFileKey(oldPath)
    const value = await store.getItem<FileContent>(oldKey)
    if (typeof value !== 'string') return

    await store.setItem(makeFileKey(newPath), value)
    await store.removeItem(oldKey)

    const fileKeys = await loadIndex()
    const nextKeys = fileKeys.includes(oldPath)
      ? fileKeys.map((k) => (k === oldPath ? newPath : k))
      : [...fileKeys, newPath]
    await saveIndex(nextKeys)
  }

  const replaceAll = async (files: Record<string, FileContent>) => {
    const existingKeys = await loadIndex()
    await Promise.all(existingKeys.map((path) => store.removeItem(makeFileKey(path))))
    await store.removeItem(INDEX_KEY)

    const entries = Object.entries(files)
    await Promise.all(entries.map(([path, content]) => store.setItem(makeFileKey(path), content)))
    await saveIndex(entries.map(([path]) => path))
  }

  return {
    loadAll,
    saveFile,
    deleteFile,
    renameFile,
    replaceAll,
  }
}
