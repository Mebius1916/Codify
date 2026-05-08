import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import localforage from 'localforage'

interface PreviewContentSize {
  width: number
  height: number
}

interface UiState {
  previewContentSize: PreviewContentSize | null
  modelApiEndpoint: string
  modelApiKey: string
  modelName: string
  aiEnhance: boolean
  figmaToken: string
  algorithmOptions: Record<string, unknown>

  setPreviewContentSize: (size: PreviewContentSize | null) => void
  setModelApiEndpoint: (endpoint: string) => void
  setModelApiKey: (key: string) => void
  setModelName: (model: string) => void
  setAiEnhance: (enabled: boolean) => void
  setFigmaToken: (token: string) => void
  setAlgorithmOptions: (next: Record<string, unknown>) => void
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
      modelApiEndpoint: '',
      modelApiKey: '',
      modelName: 'gpt-4o',
      aiEnhance: true,
      figmaToken: '',
      algorithmOptions: {},

      setPreviewContentSize: (size: PreviewContentSize | null) => {
        set({ previewContentSize: size })
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

      setFigmaToken: (token: string) => {
        set({ figmaToken: token })
      },

      setAlgorithmOptions: (next: Record<string, unknown>) => {
        set({ algorithmOptions: next })
      },
    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => uiStorage),
      // 只持久化部分字段，避免无关状态干扰
      partialize: (state) => ({
        previewContentSize: state.previewContentSize,
        modelApiEndpoint: state.modelApiEndpoint,
        modelApiKey: state.modelApiKey,
        modelName: state.modelName,
        aiEnhance: state.aiEnhance,
        figmaToken: state.figmaToken,
        algorithmOptions: state.algorithmOptions,
      }),
    }
  )
)
