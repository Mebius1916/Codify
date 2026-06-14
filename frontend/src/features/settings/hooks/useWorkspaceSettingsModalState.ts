import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@/features/workspace/store/uiStore'
import { modelApiEnvConfig } from '@/config/modelApiEnv'
import { authClient } from '@/features/auth/lib/authClient'
import { showToast } from '@/ui/appToast'
import { saveWorkspaceSettings } from '../services/workspaceSettingsApi'

interface WorkspaceSettingsModalStateOptions {
  open: boolean
  onClose: () => void
  highlightFigmaToken?: boolean
  highlightModelApiConfig?: boolean
}

export function useWorkspaceSettingsModalState({
  open,
  onClose,
  highlightFigmaToken,
  highlightModelApiConfig,
}: WorkspaceSettingsModalStateOptions) {
  const { data: session } = authClient.useSession()
  const {
    framework: storedFramework,
    stylingSystem: storedStylingSystem,
    modelApiEndpoint,
    modelApiKey,
    modelName,
    aiEnhance,
    useConvertCache,
    figmaToken,
    applyWorkspaceSettings,
  } = useUiStore((state) => ({
    framework: state.framework,
    stylingSystem: state.stylingSystem,
    modelApiEndpoint: state.modelApiEndpoint,
    modelApiKey: state.modelApiKey,
    modelName: state.modelName,
    aiEnhance: state.aiEnhance,
    useConvertCache: state.useConvertCache,
    figmaToken: state.figmaToken,
    applyWorkspaceSettings: state.applyWorkspaceSettings,
  }))

  const [framework, setFramework] = useState(storedFramework)
  const [stylingSystem, setStylingSystem] = useState(storedStylingSystem)
  const [apiEndpoint, setApiEndpoint] = useState(modelApiEndpoint)
  const [apiKey, setApiKey] = useState(modelApiKey)
  const [modelNameDraft, setModelNameDraft] = useState(modelName)
  const [aiEnhanceDraft, setAiEnhanceDraft] = useState(aiEnhance)
  const [useConvertCacheDraft, setUseConvertCacheDraft] = useState(useConvertCache)
  const [figmaTokenDraft, setFigmaTokenDraft] = useState(figmaToken)
  const [isSaving, setIsSaving] = useState(false)

  const [figmaTokenTouched, setFigmaTokenTouched] = useState(false)
  const figmaTokenInputRef = useRef<HTMLInputElement | null>(null)

  const [modelApiEndpointTouched, setModelApiEndpointTouched] = useState(false)
  const [modelApiKeyTouched, setModelApiKeyTouched] = useState(false)
  const modelApiEndpointInputRef = useRef<HTMLInputElement | null>(null)
  const modelApiKeyInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return

    setFramework(storedFramework)
    setStylingSystem(storedStylingSystem)
    setApiEndpoint(modelApiEndpoint)
    setApiKey(modelApiKey)
    setModelNameDraft(modelName)
    setAiEnhanceDraft(aiEnhance)
    setUseConvertCacheDraft(useConvertCache)
    setFigmaTokenDraft(figmaToken)

    const shouldHighlightToken = Boolean(highlightFigmaToken) && !figmaToken.trim()
    setFigmaTokenTouched(shouldHighlightToken)

    const shouldHighlightModelApiEndpoint = !modelApiEnvConfig.locked && Boolean(highlightModelApiConfig) && !modelApiEndpoint.trim()
    const shouldHighlightModelApiKey = !modelApiEnvConfig.locked && Boolean(highlightModelApiConfig) && !modelApiKey.trim()
    setModelApiEndpointTouched(shouldHighlightModelApiEndpoint)
    setModelApiKeyTouched(shouldHighlightModelApiKey)

    if (shouldHighlightToken) {
      window.setTimeout(() => {
        figmaTokenInputRef.current?.focus()
        figmaTokenInputRef.current?.scrollIntoView({ block: 'center' })
      }, 0)
      return
    }

    if (shouldHighlightModelApiEndpoint || shouldHighlightModelApiKey) {
      window.setTimeout(() => {
        const target = shouldHighlightModelApiEndpoint ? modelApiEndpointInputRef.current : modelApiKeyInputRef.current
        target?.focus()
        target?.scrollIntoView({ block: 'center' })
      }, 0)
    }
  }, [
    aiEnhance,
    figmaToken,
    highlightFigmaToken,
    highlightModelApiConfig,
    modelApiEndpoint,
    modelApiKey,
    modelName,
    open,
    storedFramework,
    storedStylingSystem,
    useConvertCache,
  ])

  const handleSave = async () => {
    if (isSaving) return

    setIsSaving(true)

    try {
      applyWorkspaceSettings({
        framework,
        stylingSystem,
        modelApiEndpoint: apiEndpoint,
        modelApiKey: apiKey,
        modelName: modelNameDraft,
        aiEnhance: aiEnhanceDraft,
        useConvertCache: useConvertCacheDraft,
        figmaToken: figmaTokenDraft,
      })

      if (session?.user.id) {
        await saveWorkspaceSettings(useUiStore.getState().getWorkspaceSettings())
      }

      onClose()
    } catch (error) {
      const message = error instanceof Error ? error.message : '保存工作区设置失败'
      showToast({ title: '保存失败', message, variant: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  const figmaTokenInvalid = !figmaTokenDraft.trim() && figmaTokenTouched
  const modelApiEndpointInvalid = !modelApiEnvConfig.locked && aiEnhanceDraft && !apiEndpoint.trim() && modelApiEndpointTouched
  const modelApiKeyInvalid = !modelApiEnvConfig.locked && aiEnhanceDraft && !apiKey.trim() && modelApiKeyTouched

  return {
    framework,
    setFramework,
    stylingSystem,
    setStylingSystem,

    apiEndpoint,
    setApiEndpoint,
    apiKey,
    setApiKey,
    modelNameDraft,
    setModelNameDraft,

    aiEnhanceDraft,
    setAiEnhanceDraft,
    useConvertCacheDraft,
    setUseConvertCacheDraft,

    figmaTokenDraft,
    setFigmaTokenDraft,
    figmaTokenTouched,
    setFigmaTokenTouched,
    figmaTokenInputRef,
    figmaTokenInvalid,

    modelApiEndpointTouched,
    setModelApiEndpointTouched,
    modelApiKeyTouched,
    setModelApiKeyTouched,
    modelApiEndpointInputRef,
    modelApiKeyInputRef,
    modelApiEndpointInvalid,
    modelApiKeyInvalid,
    modelApiLocked: modelApiEnvConfig.locked,
    isSaving,

    handleSave,
  }
}
