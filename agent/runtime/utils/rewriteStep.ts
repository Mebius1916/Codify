import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { rewriteHtml } from "../../steps/rewriteHtml.js";
import type { VisualRepairContext } from "../loop.js";

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
  onTimeout?: () => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      onTimeout?.();
      reject(new Error(message));
    }, timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timeoutId);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export function runRewriteStep(
  llm: BaseChatModel,
  context: VisualRepairContext,
  repairPatchesJson: string,
  rewriteTimeoutMs?: number,
) {
  const abortController = new AbortController();
  const rewriteContext = {
    ...context,
    input: {
      ...context.input,
      abortSignal: abortController.signal,
    },
  } satisfies VisualRepairContext;

  const rewritePromise = rewriteHtml(llm, {
    context: rewriteContext,
    repairPatchesJson,
    currentHtml: context.currentHtml,
  });

  if (!rewriteTimeoutMs) return rewritePromise;
  return withTimeout(
    rewritePromise,
    rewriteTimeoutMs,
    `rewrite 阶段超时（${rewriteTimeoutMs}ms），请检查模型接口是否可用或稍后重试`,
    () => abortController.abort(),
  );
}
