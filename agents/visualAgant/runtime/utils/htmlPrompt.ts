import { minify } from "html-minifier-terser";

const HTML_PROMPT_MINIFY_OPTIONS = {
  collapseBooleanAttributes: false,
  collapseInlineTagWhitespace: false,
  collapseWhitespace: true,
  conservativeCollapse: true,
  decodeEntities: false,
  minifyCSS: false,
  minifyJS: false,
  removeAttributeQuotes: false,
  removeComments: true,
  removeEmptyAttributes: false,
  removeOptionalTags: false,
  removeRedundantAttributes: false,
  sortAttributes: false,
  sortClassName: false,
} as const;

export async function compactHtmlForPrompt(html: string): Promise<string> {
  return minify(html, HTML_PROMPT_MINIFY_OPTIONS);
}
