import type { CodegenResult } from '../../types/figmaTypes.ts'

const RENDER_RESET_CSS = `* {
  box-sizing: border-box;
}

p,
h1,
h2,
h3,
h4,
h5,
h6 {
  margin: 0;
}

button {
  border: none;
  background: none;
  padding: 0;
}`

export function buildRenderableHtml(codegenResult: CodegenResult): string {
  const body = (codegenResult.body || codegenResult.html).trim()
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
${RENDER_RESET_CSS}
${codegenResult.css}
  </style>
</head>
<body>
${body}
</body>
</html>`
}
