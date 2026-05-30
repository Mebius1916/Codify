import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import localforage from 'localforage'

interface PreviewContentSize {
  width: number
  height: number
}

interface UiState {
  previewContentSize: PreviewContentSize | null
  previewZoomPercent: number
  modelApiEndpoint: string
  modelApiKey: string
  modelName: string
  aiEnhance: boolean
  useConvertCache: boolean
  figmaToken: string

  setPreviewContentSize: (size: PreviewContentSize | null) => void
  setPreviewZoomPercent: (zoomPercent: number) => void
  setModelApiEndpoint: (endpoint: string) => void
  setModelApiKey: (key: string) => void
  setModelName: (model: string) => void
  setAiEnhance: (enabled: boolean) => void
  setUseConvertCache: (enabled: boolean) => void
  setFigmaToken: (token: string) => void
}

type SetState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean
) => void

// 创建一个 localforage 实例专门用于 UI store
const uiStorage = localforage.createInstance({
  name: 'codeflow-uiStore',
})

export const useUiStore = create<UiState>()(
  persist(
    (set: SetState<UiState>) => ({
      previewContentSize: null,
      previewZoomPercent: 100,
      modelApiEndpoint: '',
      modelApiKey: '',
      modelName: 'gpt-4o',
      aiEnhance: false,
      useConvertCache: true,
      figmaToken: '',

      setPreviewContentSize: (size: PreviewContentSize | null) => {
        set({ previewContentSize: size })
      },
      setPreviewZoomPercent: (zoomPercent: number) => {
        set({ previewZoomPercent: zoomPercent })
      },

      setModelApiEndpoint: (endpoint: string) => {
        set({ modelApiEndpoint: endpoint })
      },

      setModelApiKey: (key: string) => {
        set({ modelApiKey: key })
      },

      setModelName: (model: string) => {
        set({ modelName: model })
      },

      setAiEnhance: (enabled: boolean) => {
        set({ aiEnhance: enabled })
      },

      setUseConvertCache: (enabled: boolean) => {
        set({ useConvertCache: enabled })
      },

      setFigmaToken: (token: string) => {
        set({ figmaToken: token })
      },

    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => uiStorage),
      // 只持久化部分字段，避免无关状态干扰
      partialize: (state) => ({
        previewContentSize: state.previewContentSize,
        previewZoomPercent: state.previewZoomPercent,
        modelApiEndpoint: state.modelApiEndpoint,
        modelApiKey: state.modelApiKey,
        modelName: state.modelName,
        aiEnhance: state.aiEnhance,
        useConvertCache: state.useConvertCache,
        figmaToken: state.figmaToken,
      }),
    }
  )
)
