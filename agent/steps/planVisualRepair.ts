import {
  AIMessage,
  HumanMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";

import {
  repairPatchListSchema,
  type RepairPatch,
} from "../interfaces/repairPatch.js";
import { planVisualRepairSystemPrompt } from "../prompts/plan.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { toLLMMessages } from "../runtime/utils/llmContext.js";
import { logAgentEvent } from "../runtime/utils/logger.js";
import { sanitizers } from "../sanitizers/index.js";

export interface PlanVisualRepairInput {
  context: VisualRepairContext;
  currentHtml: string;
}

export interface PlanVisualRepairOutput {
  patches: RepairPatch[];
  appendedMessages: BaseMessage[];
}

function buildPlanInstruction(currentHtml: string): string {
  return [
    planVisualRepairSystemPrompt,
    "",
    "===== 本步任务 =====",
    "请基于上文的视觉上下文（baseline/current/diff 三张图）与之前的观察结论，",
    "结合下面的当前 Tailwind HTML 片段，生成一份按优先级排序的结构化修复计划。",
    "",
    "## 当前 Tailwind HTML 片段",
    currentHtml,
  ].join("\n");
}

export async function planVisualRepair(
  llm: ChatOpenAI,
  input: PlanVisualRepairInput
): Promise<PlanVisualRepairOutput> {
  // 约束大模型的输出
  const structuredLlm = llm.withStructuredOutput(repairPatchListSchema, {
    name: "RepairPatchList",
    strict: true,
  });

  const instruction = new HumanMessage(buildPlanInstruction(input.currentHtml));

  // 由 context 现场投影出消息序列（system + 视觉槽 + 裁剪后的 history），再追加本步指令。
  logAgentEvent("plan:project-messages:start", { round: input.context.round });
  const projected = await toLLMMessages(input.context, llm);
  logAgentEvent("plan:llm:start", {
    round: input.context.round,
    messages: projected.length + 1,
  });
  const rawPatches = await structuredLlm.invoke([...projected, instruction]);
  const patches = sanitizers.plan(rawPatches, { currentHtml: input.currentHtml });
  logAgentEvent("plan:llm:done", {
    round: input.context.round,
    patches: patches.length,
  });

  // 把本步的 Human 指令 + AI 的 patches 结果 append 回去，作为后续 rewrite/review 可见的历史。
  const appendedMessages: BaseMessage[] = [
    instruction,
    new AIMessage(JSON.stringify(patches, null, 2)),
  ];

  return { patches, appendedMessages };
}
