import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import localforage from 'localforage'
import { applyModelApiEnvDefaults, modelApiEnvConfig } from '@/config/modelApiEnv'

interface PreviewContentSize {
  width: number
  height: number
}

export interface WorkspaceSettings {
  framework: string
  stylingSystem: string
  modelApiEndpoint: string
  modelApiKey: string
  modelName: string
  aiEnhance: boolean
  useConvertCache: boolean
  figmaToken: string
}

interface UiState {
  previewContentSize: PreviewContentSize | null
  previewZoomPercent: number
  framework: string
  stylingSystem: string
  modelApiEndpoint: string
  modelApiKey: string
  modelName: string
  aiEnhance: boolean
  useConvertCache: boolean
  figmaToken: string

  setPreviewContentSize: (size: PreviewContentSize | null) => void
  setPreviewZoomPercent: (zoomPercent: number) => void
  setFramework: (framework: string) => void
  setStylingSystem: (stylingSystem: string) => void
  setModelApiEndpoint: (endpoint: string) => void
  setModelApiKey: (key: string) => void
  setModelName: (model: string) => void
  setAiEnhance: (enabled: boolean) => void
  setUseConvertCache: (enabled: boolean) => void
  setFigmaToken: (token: string) => void
  applyWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => void
  getWorkspaceSettings: () => WorkspaceSettings
}

// 创建一个 localforage 实例专门用于 UI store
const uiStorage = localforage.createInstance({
  name: 'codeflow-uiStore',
})

export const useUiStore = create<UiState>()(
  persist(
    (set, get) => ({
      previewContentSize: null,
      previewZoomPercent: 100,
      framework: 'HTML + CSS',
      stylingSystem: 'CSS',
      modelApiEndpoint: modelApiEnvConfig.endpoint,
      modelApiKey: modelApiEnvConfig.locked ? 'Configured on server' : '',
      modelName: modelApiEnvConfig.model || 'gpt-4o',
      aiEnhance: modelApiEnvConfig.locked,
      useConvertCache: true,
      figmaToken: '',

      setPreviewContentSize: (size: PreviewContentSize | null) => {
        set({ previewContentSize: size })
      },
      setPreviewZoomPercent: (zoomPercent: number) => {
        set({ previewZoomPercent: zoomPercent })
      },

      setFramework: (framework: string) => {
        set({ framework })
      },

      setStylingSystem: (stylingSystem: string) => {
        set({ stylingSystem })
      },

      setModelApiEndpoint: (endpoint: string) => {
        if (modelApiEnvConfig.locked) {
          set({ modelApiEndpoint: modelApiEnvConfig.endpoint })
          return
        }
        set({ modelApiEndpoint: endpoint })
      },

      setModelApiKey: (key: string) => {
        if (modelApiEnvConfig.locked) {
          set({ modelApiKey: 'Configured on server' })
          return
        }
        set({ modelApiKey: key })
      },

      setModelName: (model: string) => {
        if (modelApiEnvConfig.locked) {
          set({ modelName: modelApiEnvConfig.model })
          return
        }
        set({ modelName: model })
      },

      setAiEnhance: (enabled: boolean) => {
        if (modelApiEnvConfig.locked) {
          set({ aiEnhance: true })
          return
        }
        set({ aiEnhance: enabled })
      },

      setUseConvertCache: (enabled: boolean) => {
        set({ useConvertCache: enabled })
      },

      setFigmaToken: (token: string) => {
        set({ figmaToken: token })
      },

      applyWorkspaceSettings: (settings: Partial<WorkspaceSettings>) => {
        set((state) => applyModelApiEnvDefaults({
          ...state,
          ...settings,
        }))
      },

      getWorkspaceSettings: (): WorkspaceSettings => {
        const state = get()
        return {
          framework: state.framework,
          stylingSystem: state.stylingSystem,
          modelApiEndpoint: state.modelApiEndpoint,
          modelApiKey: state.modelApiKey,
          modelName: state.modelName,
          aiEnhance: state.aiEnhance,
          useConvertCache: state.useConvertCache,
          figmaToken: state.figmaToken,
        }
      },

    }),
    {
      name: 'ui-storage',
      storage: createJSONStorage(() => uiStorage),
      // 只持久化部分字段，避免无关状态干扰
      partialize: (state) => ({
        previewContentSize: state.previewContentSize,
        previewZoomPercent: state.previewZoomPercent,
        framework: state.framework,
        stylingSystem: state.stylingSystem,
        modelApiEndpoint: state.modelApiEndpoint,
        modelApiKey: state.modelApiKey,
        modelName: state.modelName,
        aiEnhance: state.aiEnhance,
        useConvertCache: state.useConvertCache,
        figmaToken: state.figmaToken,
      }),
      merge: (persisted, current) => applyModelApiEnvDefaults({
        ...current,
        ...(persisted as Partial<UiState>),
      }),
    }
  )
)
