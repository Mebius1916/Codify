import { HumanMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";

import {
  MAX_OBSERVE_GROUPS,
  observeOutputSchema,
  type ObserveGroup,
} from "../interfaces/observeFinding.js";
import type { VisualRepairContext } from "../runtime/loop.js";
import { compactHtmlForPrompt } from "../runtime/utils/htmlPrompt.js";
import {
  buildObserveInstruction,
  buildObserveVisualContextMessage,
} from "./utils/observePrompt.js";

export interface ObserveVisualDiffInput {
  context: VisualRepairContext;
  currentHtml: string;
}

export interface ObserveVisualDiffOutput {
  summary: string;
  figmaDescription: string;
  groups: ObserveGroup[];
}

export async function observeVisualDiff(
  llm: BaseChatModel,
  input: ObserveVisualDiffInput
): Promise<ObserveVisualDiffOutput> {
  const structuredLlm = llm.withStructuredOutput(observeOutputSchema, {
    name: "ObserveOutput",
    strict: true,
  });

  const promptHtml = await compactHtmlForPrompt(input.currentHtml);
  const instruction = new HumanMessage(buildObserveInstruction(promptHtml));
  const projected = buildObserveVisualContextMessage(input.context);

  const rawGroups = await structuredLlm.invoke([...projected, instruction], {
    signal: input.context.input.abortSignal,
  });

  const parsed = observeOutputSchema.parse(rawGroups);
  const summary = parsed.summary.trim();
  const figmaDescription = parsed.figmaDescription.trim();

  const groups = parsed.groups
    .map((group) => ({
      ...group,
      dataIds: group.dataIds.map((dataId) => dataId.trim()).filter(Boolean),
      observation: group.observation.trim(),
      acceptance: group.acceptance.trim(),
    }))
    .filter(
      (group) =>
        group.dataIds.length >= 2 &&
        group.observation &&
        group.acceptance,
    )
    .slice(0, MAX_OBSERVE_GROUPS);

  return { summary, figmaDescription, groups };
}
