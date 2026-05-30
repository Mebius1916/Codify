import { SystemMessage, type BaseMessage } from "@langchain/core/messages";

import { buildVisualContextMessage } from "../../utils/visualContextSlot.js";
import type { VisualRepairContext } from "../loop.js";

const GLOBAL_SYSTEM_PROMPT = [
  "你是资深前端视觉还原评审与修复助手。",
  "仅在观察阶段会提供三张视觉上下文图：baseline（设计稿，唯一真理）、current（当前 HTML 渲染的最新截图）、diff（两者像素差异图）。",
  "这是固定工作流，不依赖完整聊天历史；每一步只会收到当前步骤必要的结构化输入。",
].join("\n");

export function toLLMMessages(
  ctx: VisualRepairContext,
  options?: { includeVisualContext?: boolean },
): BaseMessage[] {
  const includeVisualContext = options?.includeVisualContext ?? false;
  const messages: BaseMessage[] = [new SystemMessage(GLOBAL_SYSTEM_PROMPT)];

  if (includeVisualContext) {
    messages.push(
      buildVisualContextMessage({
        baselinePngBase64: ctx.input.baselinePngBase64,
        currentPngBase64: ctx.currentPngBase64,
        diffPngBase64: ctx.diffPngBase64,
        diffRatio: ctx.diffRatio,
      }),
    );
  }

  return messages;
}
