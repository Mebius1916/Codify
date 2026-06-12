import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import {
  repairPlanGroupListSchema,
  type RepairPlanGroup,
} from "../interfaces/repairPatch.js";
import type { ObserveGroup } from "../interfaces/observeFinding.js";
import { planVisualRepairSystemPrompt } from "../prompts/plan.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { compactHtmlForPrompt } from "../runtime/utils/htmlPrompt.js";
import { sanitizers } from "../sanitizers/index.js";

export interface PlanVisualRepairInput {
  context: VisualRepairContext;
  currentHtml: string;
  groups: ObserveGroup[];
}

export interface PlanVisualRepairOutput {
  planGroups: { groups: RepairPlanGroup[] };
}

function buildPlanInstruction(
  figmaDescription: string,
  groupsJson: string,
  currentHtml: string,
): string {
  return [
    planVisualRepairSystemPrompt,
    "",
    "===== 本步任务 =====",
    "请基于观察结果和当前参考代码，直接生成结构化修复计划 groups。",
    "",
    "## Figma 渲染图描述",
    figmaDescription || "(empty)",
    "",
    "## 观察结果 groups",
    groupsJson,
    "",
    "## 当前参考代码",
    currentHtml,
  ].join("\n");
}

export async function planVisualRepair(
  llm: BaseChatModel,
  input: PlanVisualRepairInput
): Promise<PlanVisualRepairOutput> {
  const structuredLlm = llm.withStructuredOutput(repairPlanGroupListSchema, {
    name: "RepairPlanGroupList",
    strict: true,
  });

  const promptHtml = await compactHtmlForPrompt(input.currentHtml);
  const groupsJson = JSON.stringify(input.groups, null, 2);
  const instruction = new HumanMessage(
    buildPlanInstruction(
      input.context.observeFigmaDescription ?? "",
      groupsJson,
      promptHtml,
    )
  );
  const rawPlanGroups = await structuredLlm.invoke([instruction], {
    signal: input.context.input.abortSignal,
  });
  const planGroups = sanitizers.plan(repairPlanGroupListSchema.parse(rawPlanGroups), {
    currentHtml: input.currentHtml,
  });

  return { planGroups };
}
