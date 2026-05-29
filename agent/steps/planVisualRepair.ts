import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import {
  repairPatchListSchema,
  type RepairPatch,
} from "../interfaces/repairPatch.js";
import type { ObserveFinding } from "../interfaces/observeFinding.js";
import { planVisualRepairSystemPrompt } from "../prompts/plan.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { compactHtmlForPrompt } from "../runtime/utils/htmlPrompt.js";
import { toLLMMessages } from "../runtime/utils/llmContext.js";
import { sanitizers } from "../sanitizers/index.js";

export interface PlanVisualRepairInput {
  context: VisualRepairContext;
  currentHtml: string;
  findings: ObserveFinding[];
}

export interface PlanVisualRepairOutput {
  patches: RepairPatch[];
}

function buildPlanInstruction(findingsJson: string, currentHtml: string): string {
  return [
    planVisualRepairSystemPrompt,
    "",
    "===== 本步任务 =====",
    "请基于观察结果和当前参考代码，直接生成结构化修复计划 patches。",
    "",
    "## 观察结果 findings",
    findingsJson,
    "",
    "## 当前参考代码",
    currentHtml,
  ].join("\n");
}

export async function planVisualRepair(
  llm: BaseChatModel,
  input: PlanVisualRepairInput
): Promise<PlanVisualRepairOutput> {
  const structuredLlm = llm.withStructuredOutput(repairPatchListSchema, {
    name: "RepairPatchList",
    strict: true,
  });

  const promptHtml = await compactHtmlForPrompt(input.currentHtml);
  const findingsJson = JSON.stringify(input.findings, null, 2);
  const instruction = new HumanMessage(
    buildPlanInstruction(findingsJson, promptHtml)
  );
  const projected = toLLMMessages(input.context);

  const rawPatches = await structuredLlm.invoke([...projected, instruction], {
    signal: input.context.input.abortSignal,
  });
  const patches = sanitizers.plan(repairPatchListSchema.parse(rawPatches), {
    currentHtml: input.currentHtml,
  });

  return { patches };
}
