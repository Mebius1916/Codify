import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import {
  reviewResultSchema,
  type ReviewResult,
} from "../interfaces/reviewResult.js";
import { reviewHtmlSystemPrompt } from "../prompts/review.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { toLLMMessages } from "../runtime/utils/llmContext.js";
import { logAgentEvent } from "../runtime/utils/logger.js";
import { sanitizers } from "../sanitizers/index.js";

export interface ReviewHtmlInput {
  context: VisualRepairContext;
  repairPatchesJson: string;
  currentHtml: string;
}

export interface ReviewHtmlOutput {
  result: ReviewResult;
  appendedMessages: BaseMessage[];
}

function buildReviewInstruction(
  repairPatchesJson: string,
  currentHtml: string
): string {
  return [
    reviewHtmlSystemPrompt,
    "",
    "===== 本步任务 =====",
    "你现在既能看到 messages 顶部的最新视觉上下文（baseline / 最新 current / 最新 diff 三张图），",
    "也能从上文读到之前的观察结论、修复计划与 rewrite 后的 HTML。",
    "请综合代码层与视觉层信息，判断本轮 rewrite 是否合理、是否需要继续下一轮修复。",
    "",
    "## 结构化修复计划",
    repairPatchesJson,
    "",
    "## 修复后的 Tailwind HTML 片段",
    currentHtml,
  ].join("\n");
}

export async function reviewHtml(
  llm: ChatOpenAI,
  input: ReviewHtmlInput
): Promise<ReviewHtmlOutput> {
  const structuredLlm = llm.withStructuredOutput(reviewResultSchema, {
    name: "ReviewResult",
    strict: true,
  });

  const instruction = new HumanMessage(
    buildReviewInstruction(input.repairPatchesJson, input.currentHtml)
  );

  // 由 context 现场投影出消息序列（system + 视觉槽 + 裁剪后的 history），再追加本步指令。
  logAgentEvent("review:project-messages:start", { round: input.context.round });
  const projected = await toLLMMessages(input.context, llm);
  logAgentEvent("review:llm:start", {
    round: input.context.round,
    messages: projected.length + 1,
  });
  const rawResult = await structuredLlm.invoke([...projected, instruction]);
  const result = sanitizers.review(rawResult);
  logAgentEvent("review:llm:done", {
    round: input.context.round,
    status: result.status,
  });

  // 把本步的 Human 指令 + AI 的 review 结果 append 回去，下一轮 plan/rewrite 就能从上文看到"上一轮 review 为什么不过"。
  const appendedMessages: BaseMessage[] = [
    instruction,
    new AIMessage(JSON.stringify(result, null, 2)),
  ];

  return { result, appendedMessages };
}
