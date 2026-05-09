import {
  SystemMessage,
  trimMessages,
  type BaseMessage,
} from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";

import { buildVisualContextMessage } from "../../utils/visualContextSlot.js";
import type { VisualRepairContext } from "../loop.js";

const GLOBAL_SYSTEM_PROMPT = [
  "你是资深前端视觉还原评审与修复助手。",
  "在整个对话过程中，前置的视觉上下文消息包含三张图：baseline（设计稿，唯一真理）、current（当前 HTML 渲染的最新截图）、diff（两者像素差异图）。",
  "每轮 rewrite 后 current 和 diff 会被更新为最新值，baseline 永远不变。",
  "你需要结合上文所有结构化输出（观察/计划/改写）来推进下一步决策。",
].join("\n");

const MAX_HISTORY_TOKENS = 100_000;

export async function toLLMMessages(
  ctx: VisualRepairContext,
  llm: ChatOpenAI
): Promise<BaseMessage[]> {
  const baseline: BaseMessage[] = [
    new SystemMessage(GLOBAL_SYSTEM_PROMPT),
    buildVisualContextMessage({
      baselinePngBase64: ctx.input.baselinePngBase64,
      currentPngBase64: ctx.currentPngBase64,
      diffPngBase64: ctx.diffPngBase64,
      rewriteRounds: ctx.rewriteRounds,
      diffRatio: ctx.diffRatio,
    }),
  ];

  if (ctx.visualRegressionError) {
    baseline.push(
      new SystemMessage(
        [
          "运行时提示：上一轮 rewrite 后视觉回归渲染或 diff 失败。",
          "当前 messages 顶部的 current/diff 可能不是最新 rewrite 的渲染结果。",
          `失败原因：${ctx.visualRegressionError}`,
        ].join("\n")
      )
    );
  }

  if (ctx.history.length === 0) {
    return baseline;
  }

  const trimmedHistory = await trimMessages(ctx.history, {
    maxTokens: MAX_HISTORY_TOKENS,
    strategy: "last",
    startOn: undefined,
    tokenCounter: llm,
    includeSystem: false,
    allowPartial: false,
  });

  return [...baseline, ...trimmedHistory];
}
