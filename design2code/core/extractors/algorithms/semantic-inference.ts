import type { SimplifiedNode } from "../../types/extractor-types.js";

export function inferSemanticTags(nodes: SimplifiedNode[]): SimplifiedNode[] {
  return nodes.map((node) => {
    if (!node.semanticTag) {
      const lowerName = node.name.toLowerCase();
      const tagFromName = inferTagFromName(lowerName, node.type);
      if (tagFromName) {
        node.semanticTag = tagFromName;
      }
    }
    if (node.children && node.children.length > 0) {
      node.children = inferSemanticTags(node.children);
    }
    return node;
  });
}

function inferTagFromName(name: string, type: SimplifiedNode["type"]): SimplifiedNode["semanticTag"] | undefined {
  if (type === "TEXT") {
    const headingMatch = name.match(/h([1-6])\b|heading/);
    if (headingMatch) {
      const level = headingMatch[1] || "2";
      return `h${level}` as SimplifiedNode["semanticTag"];
    }
    if (name.match(/para|desc|body/)) return "p";
  }

  if (name.includes("section")) return "section";
  if (name.includes("header")) return "header";
  if (name.includes("nav")) return "nav";
  if (name.includes("article")) return "article";
  if (name.includes("aside")) return "aside";
  if (name.includes("main")) return "main";

  return undefined;
}
