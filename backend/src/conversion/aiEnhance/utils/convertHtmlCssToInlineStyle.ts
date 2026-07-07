import juice from "juice";

// 通过 juice 把外部 CSS 内联为元素的 style 属性，返回不含 <style> 的 HTML 片段。
export function convertHtmlCssToInlineStyle(
  htmlFragment: string,
  cssText: string,
): string {
  const wrapped = `<html><head></head><body>${htmlFragment}</body></html>`;
  const inlined = juice.inlineContent(wrapped, cssText, {
    removeStyleTags: true,
    preserveImportant: true,
    preserveMediaQueries: false,
    preservePseudos: false,
    applyWidthAttributes: false,
    applyHeightAttributes: false,
    applyAttributesTableElements: false,
  });
  return extractBodyFragment(inlined).trim();
}

function extractBodyFragment(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match?.[1] ?? html;
}
