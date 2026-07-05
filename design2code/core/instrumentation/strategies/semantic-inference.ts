import type { InstrumentationPacket } from "../types.js";
import {
  createInstrumentationPacket,
  createInstrumentationRecord,
} from "../records/packet.js";

export type SemanticTag = NonNullable<
  "list" | "icon" | "group" | "button" | "input" | "section" |
  "header" | "footer" | "nav" | "article" | "aside" | "main" |
  "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6"
>;

// 一次基于节点名称推断出语义标签的提交型决策。
export type SemanticTagRecord = {
  nodeId: string;
  nodeName: string;
  inferredTag: SemanticTag;
  rule: string;
};

export interface SemanticInferenceSummary {
  taggedCount: number;
}

export type SemanticInferenceAiPacket = InstrumentationPacket<SemanticInferenceSummary>;

export class SemanticInferenceInstrumentationStrategy {
  private tags: SemanticTagRecord[] = [];

  // 记录一次语义标签推断。
  recordTag(record: SemanticTagRecord): void {
    this.tags.push(record);
  }

  // 汇总累积状态并生成 packet。
  buildPacket(): SemanticInferenceAiPacket {
    const summary: SemanticInferenceSummary = {
      taggedCount: this.tags.length,
    };
    return createInstrumentationPacket(
      "semantic-inference",
      "infer semantic HTML tags from node names when none is present",
      summary,
      this.tags.map(toTagRecord),
    );
  }
}

// 将语义标签决策转换为通用 instrumentation 记录。
function toTagRecord(decision: SemanticTagRecord) {
  return createInstrumentationRecord({
    strategyPoint: "semantic-tag",
    intent: "explain which semantic tag is inferred for a node and by which naming rule",
    recordType: "semantic-tag-decision",
    targetId: decision.nodeId,
    title: decision.nodeName,
    fields: {
      inferredTag: decision.inferredTag,
      rule: decision.rule,
    },
    payload: decision,
  });
}
