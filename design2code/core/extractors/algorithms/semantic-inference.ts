import type { SimplifiedNode } from "../../types/extractor-types.js";
import type { SemanticInferenceInstrumentationStrategy } from "../../instrumentation/strategies/semantic-inference.js";

type TagInference = {
  tag: NonNullable<SimplifiedNode["semanticTag"]>;
  rule: string;
};

// 为缺少语义标签的节点按名称推断 HTML 语义标签，可选记录 AI 证据。
export function inferSemanticTags(
  nodes: SimplifiedNode[],
  instrumentation?: SemanticInferenceInstrumentationStrategy,
): SimplifiedNode[] {
  return nodes.map((node) => {
    if (!node.semanticTag) {
      const inference = inferTagFromName(node.name.toLowerCase(), node.type);
      if (inference) {
        node.semanticTag = inference.tag;
        instrumentation?.recordTag({
          nodeId: node.id,
          nodeName: node.name,
          inferredTag: inference.tag,
          rule: inference.rule,
        });
      }
    }
    if (node.children && node.children.length > 0) {
      node.children = inferSemanticTags(node.children, instrumentation);
    }
    return node;
  });
}

// 依据名称匹配推断语义标签，并返回命中的规则名。
function inferTagFromName(name: string, type: SimplifiedNode["type"]): TagInference | undefined {
  if (type === "TEXT") {
    const headingMatch = name.match(/h([1-6])\b|heading/);
    if (headingMatch) {
      const level = headingMatch[1] || "2";
      return { tag: `h${level}` as TagInference["tag"], rule: "text-heading" };
    }
    if (name.match(/para|desc|body/)) return { tag: "p", rule: "text-paragraph" };
  }

  if (name.includes("section")) return { tag: "section", rule: "name-section" };
  if (name.includes("header")) return { tag: "header", rule: "name-header" };
  if (name.includes("nav")) return { tag: "nav", rule: "name-nav" };
  if (name.includes("article")) return { tag: "article", rule: "name-article" };
  if (name.includes("aside")) return { tag: "aside", rule: "name-aside" };
  if (name.includes("main")) return { tag: "main", rule: "name-main" };

  return undefined;
}
