import type { VisualRepairContext } from "../loop.js";

function formatRuntimeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function throwIfAgentAborted(context: VisualRepairContext) {
  context.input.abortSignal?.throwIfAborted();
}

export function reportAgentProgress(
  context: VisualRepairContext,
  event: string,
  details?: Record<string, unknown>
) {
  context.input.onProgress?.({
    event,
    details: {
      round: context.round,
      rewriteRounds: context.rewriteRounds,
      ...details,
    },
  });
}

export async function runWithAgentProgress<T>(
  context: VisualRepairContext,
  event: string,
  details: Record<string, unknown>,
  task: () => Promise<T>,
  getResultDetails?: (result: T) => Record<string, unknown>
): Promise<T> {
  const startedAt = Date.now();
  throwIfAgentAborted(context);
  reportAgentProgress(context, event, {
    ...details,
    status: "start",
  });

  try {
    const result = await task();
    throwIfAgentAborted(context);
    reportAgentProgress(context, event, {
      ...details,
      ...getResultDetails?.(result),
      status: "done",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    reportAgentProgress(context, event, {
      ...details,
      status: "error",
      durationMs: Date.now() - startedAt,
      error: formatRuntimeError(error),
    });
    throw error;
  }
}
