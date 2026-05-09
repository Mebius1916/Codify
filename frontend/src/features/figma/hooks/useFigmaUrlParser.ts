import { useState } from 'react';
import { useUiStore } from '@/features/workspace/store/uiStore';
import { convertFigma, type ConvertFigmaLogEntry } from '../services/figma';
import type { FigmaConvertResult } from '../interfaces/model';

type FigmaUrlParserState =
  | { status: 'idle' }
  | { status: 'loading'; logs: ConvertFigmaLogEntry[] }
  | { status: 'success'; data: FigmaConvertResult }
  | { status: 'error'; error: string };

export function useFigmaUrlParser() {
  const [state, setState] = useState<FigmaUrlParserState>({ status: 'idle' });
  const {
    figmaToken,
    aiEnhance,
    modelApiEndpoint,
    modelApiKey,
    modelName,
  } = useUiStore((s) => ({
    figmaToken: s.figmaToken,
    aiEnhance: s.aiEnhance,
    modelApiEndpoint: s.modelApiEndpoint,
    modelApiKey: s.modelApiKey,
    modelName: s.modelName,
  }));

  const parse = async (inputUrl: string) => {
    if (!inputUrl) {
      setState({ status: 'error', error: '请输入 figma url' });
      return null;
    }

    const token = figmaToken.trim();
    if (!token) {
      setState({ status: 'error', error: '请先在 Settings 填写 Figma Token' });
      return null;
    }

    setState({ status: 'loading', logs: [] });

    try {
      const result = await convertFigma({
        figmaUrl: inputUrl,
        token,
        aiEnhance,
        aiOptions: aiEnhance
          ? {
              baseUrl: modelApiEndpoint.trim(),
              apiKey: modelApiKey.trim(),
              model: modelName.trim(),
	            }
	          : undefined,
        onLog: (entry) => {
          setState((prev) => {
            if (prev.status !== 'loading') return prev
            return { status: 'loading', logs: [...prev.logs, entry].slice(-20) }
          })
        },
      });
      setState({ status: 'success', data: result });
      return result;
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : '链接格式无效，请输入完整的 Figma URL';
      setState({ status: 'error', error: errorMsg });
      return null;
    }
  };

  const clearError = () => {
    setState((prev: FigmaUrlParserState) => (prev.status === 'error' ? { status: 'idle' } : prev));
  };

  return {
    state,
    parse,
    clearError
  };
}
