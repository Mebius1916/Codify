import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";

import {
  rewriteResultSchema,
  type RewriteResult,
} from "../interfaces/rewriteResult.js";
import { rewriteHtmlSystemPrompt } from "../prompts/rewrite.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { toLLMMessages } from "../runtime/utils/llmContext.js";
import { sanitizers } from "../sanitizers/index.js";

export interface RewriteHtmlInput {
  context: VisualRepairContext;
  repairPatchesJson: string;
  currentHtml: string;
}

export interface RewriteHtmlOutput {
  result: RewriteResult;
  appendedMessages: BaseMessage[];
}

function buildRewriteInstruction(
  repairPatchesJson: string,
  currentHtml: string
): string {
  return [
    rewriteHtmlSystemPrompt,
    "",
    "===== 本步任务 =====",
    "请基于上文的视觉上下文（baseline/current/diff 三张图）与之前的观察结论，",
    "按下面的结构化修复计划修改当前 Tailwind HTML 片段。",
    "",
    "## 结构化修复计划",
    repairPatchesJson,
    "",
    "## 当前 Tailwind HTML 片段",
    currentHtml,
  ].join("\n");
}

export async function rewriteHtml(
  llm: ChatOpenAI,
  input: RewriteHtmlInput
): Promise<RewriteHtmlOutput> {
  const structuredLlm = llm.withStructuredOutput(rewriteResultSchema, {
    name: "RewriteResult",
    strict: true,
  });

  const instruction = new HumanMessage(
    buildRewriteInstruction(input.repairPatchesJson, input.currentHtml)
  );

  // 由 context 现场投影出消息序列（system + 视觉槽 + 裁剪后的 history），再追加本步指令。
  const projected = await toLLMMessages(input.context, llm);
  const rawResult = await structuredLlm.invoke([...projected, instruction]);
  const result = sanitizers.rewrite(rawResult, {
    previousHtml: input.currentHtml,
  });

  // AI 侧 append 的内容只放 html 字段本身
  const appendedMessages: BaseMessage[] = [
    instruction,
    new AIMessage(result.html),
  ];

  return { result, appendedMessages };
}
