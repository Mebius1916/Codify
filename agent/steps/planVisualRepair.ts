import { HumanMessage } from "@langchain/core/messages";

import type { ObserveResult } from "../interfaces/observeResult.js";
import {
  repairPatchListSchema,
  type RepairPatch,
} from "../interfaces/repairPatch.js";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { planVisualRepairSystemPrompt } from "../prompts/plan.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { compactHtmlForPrompt } from "../runtime/utils/htmlPrompt.js";
import { toLLMMessages } from "../runtime/utils/llmContext.js";
import { sanitizers } from "../sanitizers/index.js";

export interface PlanVisualRepairInput {
  context: VisualRepairContext;
  currentHtml: string;
}

export interface PlanVisualRepairOutput {
  patches: RepairPatch[];
}

function buildPlanInstruction(
  currentHtml: string,
  observation?: ObserveResult
): string {
  return [
    planVisualRepairSystemPrompt,
    "",
    "===== 本步任务 =====",
    "请基于上文的视觉上下文（baseline/current/diff 三张图）与本轮观察结论，",
    "结合下面的当前 Tailwind HTML 片段，生成一份按优先级排序的结构化修复计划。",
    "",
    observation
      ? [
          "## 本轮观察结论",
          JSON.stringify(observation, null, 2),
          "",
        ].join("\n")
      : undefined,
    "## 当前 Tailwind HTML 片段",
    currentHtml,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function planVisualRepair(
  llm: BaseChatModel,
  input: PlanVisualRepairInput
): Promise<PlanVisualRepairOutput> {
  // 约束大模型的输出
  const structuredLlm = llm.withStructuredOutput(repairPatchListSchema, {
    name: "RepairPatchList",
    strict: true,
  });

  const promptHtml = await compactHtmlForPrompt(input.currentHtml);
  const instruction = new HumanMessage(
    buildPlanInstruction(promptHtml, input.context.observation)
  );

  // 固定工作流只投影当前视觉槽；观察结果通过结构化 handoff 显式放入本步指令。
  const projected = toLLMMessages(input.context);
  const rawPatches = await structuredLlm.invoke([...projected, instruction], {
    signal: input.context.input.abortSignal,
  });
  const patches = sanitizers.plan(repairPatchListSchema.parse(rawPatches), {
    currentHtml: input.currentHtml,
  });

  return { patches };
}
