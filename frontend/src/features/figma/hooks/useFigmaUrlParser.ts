import { useState } from 'react';
import { useUiStore } from '@/features/workspace/store/uiStore';
import { convertFigma } from '../services/figma';
import type { ConvertStageEvent, FigmaConvertResult } from '../interfaces/model';
import { showToast } from '@/ui/appToast';

type FigmaUrlParserState =
  | { status: 'idle' }
  | { status: 'loading'; stage?: ConvertStageEvent }
  | { status: 'success'; data: FigmaConvertResult }
  | { status: 'error'; error: string };

export function useFigmaUrlParser() {
  const [state, setState] = useState<FigmaUrlParserState>({ status: 'idle' });
  const {
    figmaToken,
    aiEnhance,
    useConvertCache,
    modelApiEndpoint,
    modelName,
  } = useUiStore((s) => ({
    figmaToken: s.figmaToken,
    aiEnhance: s.aiEnhance,
    useConvertCache: s.useConvertCache,
    modelApiEndpoint: s.modelApiEndpoint,
    modelName: s.modelName,
  }));

  const parse = async (inputUrl: string) => {
    if (!inputUrl) {
      const message = '请输入 figma url';
      showToast({ title: 'Figma 链接缺失', message, variant: 'error' });
      setState({ status: 'error', error: message });
      return null;
    }

    const token = figmaToken.trim();
    if (!token) {
      const message = '请先在 Settings 填写 Figma Token，否则后端无法访问 Figma 文件数据';
      showToast({ title: 'Figma Token 缺失', message, variant: 'error' });
      setState({ status: 'error', error: message });
      return null;
    }

    setState({ status: 'loading' });

    try {
      const result = await convertFigma({
        figmaUrl: inputUrl,
        token,
        aiEnhance,
        useConvertCache,
        onStage: (stage) => setState({ status: 'loading', stage }),
        aiOptions: aiEnhance
          ? {
              baseUrl: modelApiEndpoint.trim(),
              model: modelName.trim(),
            }
          : undefined,
      });
      if (result.aiEnhanceMeta?.status === 'failed' && result.aiEnhanceMeta.error) {
        showToast({
          title: 'AI 增强失败',
          message: result.aiEnhanceMeta.error,
          variant: 'warning',
        });
      }
      setState({ status: 'success', data: result });
      return result;
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : '链接格式无效，请输入完整的 Figma URL';
      showToast({ message: errorMsg, variant: 'error' });
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
