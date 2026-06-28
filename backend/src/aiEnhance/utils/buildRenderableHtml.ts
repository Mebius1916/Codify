import { GENERATED_PAGE_RESET_CSS } from '@codify/design2code'
import type { CodegenResult } from '../../conversion/types.ts'

export function buildRenderableHtml(codegenResult: CodegenResult): string {
  const body = (codegenResult.body || codegenResult.html).trim()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${GENERATED_PAGE_RESET_CSS}
${codegenResult.css}
  </style>
</head>
<body>
${body}
</body>
</html>`
}
