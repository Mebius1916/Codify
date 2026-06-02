import { createLLM } from "./llm/createLLM.js";
import type { RunVisualRepairInput, RunVisualRepairParams } from "./interfaces/runtime.js";
import { runVisualRepairLoop } from "./runtime/loop.js";

export type { AgentProgressEvent } from "./interfaces/runtime.js";

export function runVisualRepair(params: RunVisualRepairInput) {
  const {
    baselinePngBase64,
    currentPngBase64,
    diffPngBase64,
    diffRatio,
    html,
    model,
    apiKey,
    baseUrl,
    temperature,
    timeout,
    onProgress,
    abortSignal,
  } = params;

  const runParams = {
    baselinePngBase64,
    currentPngBase64,
    diffPngBase64,
    diffRatio,
    html,
    model,
    apiKey,
    baseUrl,
    temperature,
    timeout,
    onProgress,
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
