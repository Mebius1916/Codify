import { createLLM } from "./llm/createLLM.js";
import type { RunVisualRepairInput, RunVisualRepairParams } from "./interfaces/runtime.js";
import { runVisualRepairLoop } from "./runtime/loop.js";

export type {
  AgentProgressEvent,
  VisualRepairObserveResult,
} from "./interfaces/runtime.js";

export function runVisualRepair(params: RunVisualRepairInput) {
  const {
    visualEvidencePngBase64,
    html,
    model,
    apiKey,
    baseUrl,
    temperature,
    timeout,
    onProgress,
    onObserve,
    abortSignal,
  } = params;

  const runParams = {
    visualEvidencePngBase64,
    html,
    model,
    apiKey,
    baseUrl,
    temperature,
    timeout,
    onProgress,
    onObserve,
    abortSignal,
  } satisfies RunVisualRepairParams;

  const llm = createLLM({
    model,
    apiKey,
    baseUrl,
    temperature,
    timeout,
  });

  return runVisualRepairLoop(llm, runParams);
}
