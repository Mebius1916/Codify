import { createLLM } from "./llm/createLLM.js";
import type { RunVisualRepairInput, RunVisualRepairParams } from "./interfaces/runtime.js";
import { runVisualRepairLoop } from "./runtime/loop.js";

export type { AgentProgressEvent } from "./interfaces/runtime.js";
export {
  answerSourceQuestion,
  buildSourceKnowledgeBase,
} from "./sourceReader/index.js";
export type {
  AnswerSourceQuestionInput,
  AnswerSourceQuestionResult,
  BuildSourceKnowledgeBaseInput,
  SourceKnowledgeBase,
  SourceKnowledgeBaseProgressEvent,
} from "./sourceReader/index.js";

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
