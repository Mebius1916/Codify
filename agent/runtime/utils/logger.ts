import { AsyncLocalStorage } from "node:async_hooks";
import type { AgentLogEntry } from "../../interfaces/runtime.js";

type AgentLogSink = (entry: AgentLogEntry) => void;

const agentLogSinkStorage = new AsyncLocalStorage<AgentLogSink>();

export function withAgentLogSink<T>(
  sink: AgentLogSink | undefined,
  fn: () => T
): T {
  if (!sink) return fn();
  return agentLogSinkStorage.run(sink, fn);
}

function formatDetails(details?: Record<string, unknown>): string {
  if (!details || Object.keys(details).length === 0) return "";
  return ` ${JSON.stringify(details)}`;
}

export function logAgentEvent(
  event: string,
  details?: Record<string, unknown>
): void {
  const entry: AgentLogEntry = {
    timestamp: new Date().toISOString(),
    level: "info",
    event,
    details,
  };
  console.info(`[agent] ${entry.timestamp} ${event}${formatDetails(details)}`);
  agentLogSinkStorage.getStore()?.(entry);
}

export function logAgentError(event: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const entry: AgentLogEntry = {
    timestamp: new Date().toISOString(),
    level: "error",
    event,
    message,
  };
  console.error(`[agent] ${entry.timestamp} ${event} ${message}`);
  agentLogSinkStorage.getStore()?.(entry);
}
