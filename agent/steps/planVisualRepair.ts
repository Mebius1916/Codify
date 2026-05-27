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
    "请基于本轮观察结论，结合下面的当前参考代码，生成一份按优先级排序的结构化修复计划。",
    "",
    observation
      ? [
          "## 本轮观察结论",
          JSON.stringify(observation, null, 2),
          "",
        ].join("\n")
      : undefined,
    "## 当前参考代码",
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

  // plan 阶段只消费 observe 的结构化结论和参考代码；图片上下文只属于 observe。
  const rawPatches = await structuredLlm.invoke([instruction], {
    signal: input.context.input.abortSignal,
  });
  const patches = sanitizers.plan(repairPatchListSchema.parse(rawPatches), {
    currentHtml: input.currentHtml,
  });

  return { patches };
}
