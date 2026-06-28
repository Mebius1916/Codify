import { parse, type HTMLElement } from "node-html-parser";

import type { ScopedHtmlPatch } from "../../interfaces/scopedHtmlPatch.js";

export function applyScopedHtmlPatches(
  currentHtml: string,
  patches: ScopedHtmlPatch[],
): string {
  const root = parse(currentHtml);

  for (const patch of patches) {
    const target = findByDataId(root, patch.id);
    if (!target) {
      throw new Error(`apply patch target not found: ${patch.id}`);
    }

    const replacement = parseSingleElement(patch.html, patch.id);
    target.replaceWith(replacement.toString());
  }

  return root.toString();
}

function parseSingleElement(html: string, id: string): HTMLElement {
  const patchRoot = parse(html.trim());
  const elements = patchRoot.childNodes.filter((node): node is HTMLElement =>
    "getAttribute" in node,
  );

  if (elements.length !== 1) {
    throw new Error(`patch ${id} html must contain exactly one root element`);
  }

  const element = elements[0];
  const rootDataId = element.getAttribute("data-id");
  if (rootDataId !== id) {
    throw new Error(
      `patch root data-id mismatch: expected ${id}, got ${rootDataId ?? "(none)"}`,
    );
  }

  return element;
}

function findByDataId(root: HTMLElement, dataId: string): HTMLElement | undefined {
  return root
    .querySelectorAll("[data-id]")
    .find((element) => element.getAttribute("data-id") === dataId);
}
