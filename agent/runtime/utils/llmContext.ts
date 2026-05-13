import { SystemMessage, type BaseMessage } from "@langchain/core/messages";

import { buildVisualContextMessage } from "../../utils/visualContextSlot.js";
import type { VisualRepairContext } from "../loop.js";

const GLOBAL_SYSTEM_PROMPT = [
  "你是资深前端视觉还原评审与修复助手。",
  "在整个对话过程中，前置的视觉上下文消息包含三张图：baseline（设计稿，唯一真理）、current（当前 HTML 渲染的最新截图）、diff（两者像素差异图）。",
  "每轮 rewrite 后 current 和 diff 会被更新为最新值，baseline 永远不变。",
  "这是固定工作流，不依赖完整聊天历史；每一步只会收到当前步骤必要的结构化输入。",
].join("\n");

export function toLLMMessages(ctx: VisualRepairContext): BaseMessage[] {
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

  return baseline;
}
