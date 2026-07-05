import type { CodeGraph as UpstreamCodeGraphInstance } from "@colbymchenry/codegraph";
import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import type { z } from "zod";

import type {
  InstrumentationProvider,
  SourceAgentBudget,
  SourceAgentEvidence,
  SourceAgentToolTrace,
} from "../interfaces/index.js";

const OUTPUT_PREVIEW_CHARS = 2_000;

// 约束层门闩：记录 AI 对异常归属的判定，未判定前不允许进入源码搜索。
export interface AnomalyGate {
  strategy: string | null;
}

// 门闩校验：未完成 classifyAnomaly（strategy 为空）前，返回阻断提示，否则返回 null。
export function anomalyGateError(gate: AnomalyGate): { error: string } | null {
  if (gate.strategy) return null;
  return {
    error:
      "Blocked: call classifyAnomaly first to attribute the anomaly to one existing strategy or 'other' before searching source.",
  };
}

export interface SourceToolContext {
  repoRoot: string;
  includeDirs?: string[];
  codeGraph: UpstreamCodeGraphInstance;
  budget?: SourceAgentBudget;
  evidence: SourceAgentEvidence[];
  toolTrace: SourceAgentToolTrace[];
  instrumentationProvider?: InstrumentationProvider;
  anomalyGate: AnomalyGate;
  onToolCall?: (event: SourceAgentToolTrace) => void;
}

// 将函数包装为tool
export function createJsonTool<T extends z.AnyZodObject>(
  context: SourceToolContext,
  name: string,
  description: string,
  schema: T,
  run: (input: z.infer<T>) => Promise<unknown> | unknown,
): StructuredToolInterface {
  return tool(
    (input) =>
      traceTool(context, name, input, async () =>
        JSON.stringify(await run(input), null, 2),
      ),
    { name, description, schema },
  );
}

// 日志追踪
export async function traceTool(
  context: SourceToolContext,
  toolName: string,
  input: Record<string, unknown>,
  run: () => Promise<string>,
): Promise<string> {
  const output = await run();
  const trace = {
    toolName,
    input,
    outputPreview: output.slice(0, OUTPUT_PREVIEW_CHARS),
  };
  context.toolTrace.push(trace);
  context.onToolCall?.(trace);
  return output;
}
