import { createLLM } from "./llm/createLLM.js";
import { diffPng } from "./utils/diffPng.js";
import type { RunVisualRepairInput, RunVisualRepairParams } from "./interfaces/runtime.js";
import { runVisualRepairLoop } from "./runtime/loop.js";

export type { AgentProgressEvent } from "./interfaces/runtime.js";

export function runVisualRepair(params: RunVisualRepairInput) {
  const {
    baselinePngBase64,
    currentPngBase64,
    html,
    model,
    apiKey,
    baseUrl,
    temperature,
    rewriteTimeoutMs,
    threshold,
    onProgress,
    abortSignal,
  } = params;

  const diff = diffPng(baselinePngBase64, currentPngBase64, threshold);

  const runParams = {
    baselinePngBase64,
    currentPngBase64,
    diffPngBase64: diff.diffBase64,
    diffRatio: diff.diffRatio,
    html,
    model,
    apiKey,
    baseUrl,
    temperature,
    rewriteTimeoutMs,
    onProgress,
    abortSignal,
  } satisfies RunVisualRepairParams;

  const llm = createLLM({
    model,
    apiKey,
    baseUrl,
    temperature,
  });

  return runVisualRepairLoop(llm, runParams);
}
