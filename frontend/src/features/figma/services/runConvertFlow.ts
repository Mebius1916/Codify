import { GENERATED_PAGE_RESET_CSS } from '@codify/design2code'
import { createLocalForageContentRepository } from '@/features/workspace/repository/contentRepository'
import { useEditorStore } from '@/features/workspace/store/editorStore'
import { useUiStore } from '@/features/workspace/store/uiStore'
import type { FigmaConvertResult } from '../interfaces/model'
import { formatCss, formatHtml } from '@/utils/format'

export async function runConvertFlow(result: FigmaConvertResult) {
  const size = result.codegenResult?.size
  const nextSize = size?.width && size?.height ? size : undefined
  useUiStore.getState().setPreviewContentSize(nextSize ?? null)

  const enhanced = result.aiEnhanceMeta?.status === 'done' ? result.aiEnhancedResult : undefined
  const { html, body, css } = result.codegenResult
  const files: Record<string, string> = {
    'src/index.html': formatHtml(enhanced?.html ?? body ?? html),
    'src/reset.css': `${GENERATED_PAGE_RESET_CSS}\n`,
    'src/style.css': formatCss(enhanced?.css ?? css),
  }

  const { initializeFiles, openFile } = useEditorStore.getState()
  initializeFiles(files)
  openFile('src/index.html')

  const repo = createLocalForageContentRepository()
  await repo.replaceAll(files)
}
