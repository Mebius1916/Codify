import { useEffect, useRef, useState } from 'react'
import { useUiStore } from '@/features/workspace/store/uiStore'
import { getDefaultOptions, type AlgorithmOptions } from '@codify/design2code'

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
  const {
    modelApiEndpoint,
    modelApiKey,
    modelName,
    aiEnhance,
    figmaToken,
    algorithmOptions,
    setModelApiEndpoint,
    setModelApiKey,
    setModelName,
    setAiEnhance,
    setFigmaToken,
    setAlgorithmOptions,
  } = useUiStore((state) => ({
    modelApiEndpoint: state.modelApiEndpoint,
    modelApiKey: state.modelApiKey,
    modelName: state.modelName,
    aiEnhance: state.aiEnhance,
    figmaToken: state.figmaToken,
    algorithmOptions: state.algorithmOptions,
    setModelApiEndpoint: state.setModelApiEndpoint,
    setModelApiKey: state.setModelApiKey,
    setModelName: state.setModelName,
    setAiEnhance: state.setAiEnhance,
    setFigmaToken: state.setFigmaToken,
    setAlgorithmOptions: state.setAlgorithmOptions,
  }))

  const [framework, setFramework] = useState('HTML + CSS')
  const [stylingSystem, setStylingSystem] = useState('CSS')
  const [apiEndpoint, setApiEndpoint] = useState(modelApiEndpoint)
  const [apiKey, setApiKey] = useState(modelApiKey)
  const [modelNameDraft, setModelNameDraft] = useState(modelName)
  const [aiEnhanceDraft, setAiEnhanceDraft] = useState(aiEnhance)
  const [figmaTokenDraft, setFigmaTokenDraft] = useState(figmaToken)

  const [figmaTokenTouched, setFigmaTokenTouched] = useState(false)
  const figmaTokenInputRef = useRef<HTMLInputElement | null>(null)

  const [modelApiEndpointTouched, setModelApiEndpointTouched] = useState(false)
  const [modelApiKeyTouched, setModelApiKeyTouched] = useState(false)
  const modelApiEndpointInputRef = useRef<HTMLInputElement | null>(null)
  const modelApiKeyInputRef = useRef<HTMLInputElement | null>(null)

  const [algorithmOptionsEnabled, setAlgorithmOptionsEnabled] = useState(false)
  const [algorithmOptionsDraft, setAlgorithmOptionsDraft] = useState<AlgorithmOptions>(() => {
    return Object.keys(algorithmOptions).length ? (algorithmOptions as unknown as AlgorithmOptions) : getDefaultOptions()
  })

  useEffect(() => {
    if (!open) return

    setApiEndpoint(modelApiEndpoint)
    setApiKey(modelApiKey)
    setModelNameDraft(modelName)
    setAiEnhanceDraft(aiEnhance)
    setFigmaTokenDraft(figmaToken)

    const shouldHighlightToken = Boolean(highlightFigmaToken) && !figmaToken.trim()
    setFigmaTokenTouched(shouldHighlightToken)

    const shouldHighlightModelApiEndpoint = Boolean(highlightModelApiConfig) && !modelApiEndpoint.trim()
    const shouldHighlightModelApiKey = Boolean(highlightModelApiConfig) && !modelApiKey.trim()
    setModelApiEndpointTouched(shouldHighlightModelApiEndpoint)
    setModelApiKeyTouched(shouldHighlightModelApiKey)

    setAlgorithmOptionsEnabled(false)
    setAlgorithmOptionsDraft(
      Object.keys(algorithmOptions).length ? (algorithmOptions as unknown as AlgorithmOptions) : getDefaultOptions(),
    )

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
    algorithmOptions,
    figmaToken,
    highlightFigmaToken,
    highlightModelApiConfig,
    modelApiEndpoint,
    modelApiKey,
    modelName,
    open,
  ])

  const handleSave = () => {
    setModelApiEndpoint(apiEndpoint)
    setModelApiKey(apiKey)
    setModelName(modelNameDraft)
    setAiEnhance(aiEnhanceDraft)
    setFigmaToken(figmaTokenDraft)
    setAlgorithmOptions(algorithmOptionsEnabled ? (algorithmOptionsDraft as unknown as Record<string, unknown>) : {})
    onClose()
  }

  const figmaTokenInvalid = !figmaTokenDraft.trim() && figmaTokenTouched
  const modelApiEndpointInvalid = !apiEndpoint.trim() && modelApiEndpointTouched
  const modelApiKeyInvalid = !apiKey.trim() && modelApiKeyTouched

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

    algorithmOptionsEnabled,
    setAlgorithmOptionsEnabled,
    algorithmOptionsDraft,
    setAlgorithmOptionsDraft,

    handleSave,
  }
}
