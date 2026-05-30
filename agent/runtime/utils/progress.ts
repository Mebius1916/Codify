import type { VisualRepairContext } from "../loop.js";

function formatRuntimeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function summarizeForProgress(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}...[truncated]` : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 10).map((item) => summarizeForProgress(item, depth + 1));
  }

  const record = value as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    summary[key] = summarizeForProgress(val, depth + 1);
  }
  return summary;
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
      ...details,
    },
  });
}

export async function runWithAgentProgress<T>(
  context: VisualRepairContext,
  event: string,
  task: () => Promise<T>,
  getResultDetails?: (result: T) => Record<string, unknown>
): Promise<T> {
  const startedAt = Date.now();
  throwIfAgentAborted(context);
  reportAgentProgress(context, event, { status: "start" });

  try {
    const result = await task();
    throwIfAgentAborted(context);
    const autoDetails = { output: summarizeForProgress(result) };
    reportAgentProgress(context, event, {
      ...autoDetails,
      ...getResultDetails?.(result),
      status: "done",
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    reportAgentProgress(context, event, {
      status: "error",
      durationMs: Date.now() - startedAt,
      error: formatRuntimeError(error),
    });
    throw error;
  }
}
