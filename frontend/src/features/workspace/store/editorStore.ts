import { create } from 'zustand'
import type { StateCreator } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import localforage from 'localforage'

interface EditorState {
  activeFile: string | null
  openFiles: string[]
  fileKeys: string[]
  files: Record<string, string>

  openFile: (path: string) => void
  closeFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void
  addFile: (path: string, content: string) => void
  deleteFile: (path: string) => void
  renameFile: (oldPath: string, newPath: string) => void
  initializeFiles: (files: Record<string, string>) => void
}

const createEditorState: StateCreator<EditorState> = (set, get) => ({
      activeFile: null, // 激活文件的路径
      openFiles: [], // 打开的文件路径列表
      files: {}, // 所有文件的内容
      fileKeys: [], // 所有文件的路径列表

      initializeFiles: (files: Record<string, string>) => {
        const fileKeys = Object.keys(files)
        const { activeFile, openFiles } = get()
        const nextOpenFiles = openFiles.filter((path) => fileKeys.includes(path))
        const nextActiveFile = activeFile && fileKeys.includes(activeFile)
          ? activeFile
          : nextOpenFiles[0] ?? fileKeys[0] ?? null

        set({
          files,
          fileKeys,
          openFiles: nextActiveFile && nextOpenFiles.length === 0 ? [nextActiveFile] : nextOpenFiles,
          activeFile: nextActiveFile,
        })
      },

      openFile: (path: string) => {
        const { openFiles, activeFile } = get()
        if (activeFile === path) return
        const nextOpenFiles = openFiles.includes(path) ? openFiles : [...openFiles, path]
        set({ openFiles: nextOpenFiles, activeFile: path })
      },

      closeFile: (path: string) => {
        const { openFiles, activeFile } = get()
        const newOpenFiles = openFiles.filter((filePath) => filePath !== path)

        let newActiveFile = activeFile
        if (activeFile === path) {
          const index = openFiles.indexOf(path)
          if (newOpenFiles.length > 0) {
            newActiveFile = newOpenFiles[index - 1] || newOpenFiles[index] || newOpenFiles[0]
          } else {
            newActiveFile = null
          }
        }

        set({ openFiles: newOpenFiles, activeFile: newActiveFile })
      },

      // 更新文件内容
      updateFileContent: (path: string, content: string) => {
        const { files, fileKeys } = get()
        const newFiles = { ...files, [path]: content }
        if (files[path] !== undefined || fileKeys.includes(path)) {
          set({ files: newFiles })
          return
        }
        set({ files: newFiles, fileKeys: [...fileKeys, path] })
      },

      addFile: (path: string, content: string = '') => {
        const { files, fileKeys } = get()
        const newFiles = { ...files, [path]: content }
        if (fileKeys.includes(path)) {
          set({ files: newFiles })
          return
        }
        set({ files: newFiles, fileKeys: [...fileKeys, path] })
      },

      deleteFile: (path: string) => {
        const { openFiles, activeFile, files, fileKeys } = get()
        const newOpenFiles = openFiles.filter((filePath) => filePath !== path)
        const newFiles = { ...files }
        delete newFiles[path]
        const newFileKeys = fileKeys.filter((fileKey) => fileKey !== path)
        
        let newActiveFile = activeFile
        const wasActive = activeFile === path

        if (wasActive) {
          newActiveFile = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null
        }

        set({
          openFiles: newOpenFiles,
          activeFile: newActiveFile,
          files: newFiles,
          fileKeys: newFileKeys,
        })
      },

      renameFile: (oldPath: string, newPath: string) => {
        const { openFiles, activeFile, files, fileKeys } = get()
        if (!(oldPath in files)) return

        const newOpenFiles = openFiles.map((filePath) => (filePath === oldPath ? newPath : filePath))
        const newActiveFile = activeFile === oldPath ? newPath : activeFile
        
        const content = files[oldPath]
        const newFiles = { ...files, [newPath]: content }
        delete newFiles[oldPath]
        const newFileKeys = fileKeys.map((fileKey) => (fileKey === oldPath ? newPath : fileKey))

        set({
          openFiles: newOpenFiles,
          activeFile: newActiveFile,
          files: newFiles,
          fileKeys: newFileKeys,
        })
      },
    })

const storage = createJSONStorage(() => {
  return {
    getItem: async (name: string) => {
      const value = await localforage.getItem<string>(name)
      return value ?? null
    },
    setItem: async (name: string, value: string) => {
      await localforage.setItem(name, value)
    },
    removeItem: async (name: string) => {
      await localforage.removeItem(name)
    },
  }
})

export const useEditorStore = create<EditorState>()(
  persist(createEditorState, {
    name: 'code-editor-storage',
    storage,
    // 部分持久化
    partialize: (state) => ({
      activeFile: state.activeFile,
      openFiles: state.openFiles,
    }),
    // 合并持久化状态和当前状态
    merge: (persistedState, currentState) => {
      const restored = persistedState as Partial<EditorState> | undefined
      return {
        ...currentState,
        ...restored,
        files: currentState.files,
        fileKeys: currentState.fileKeys,
      }
    },
  }),
)
