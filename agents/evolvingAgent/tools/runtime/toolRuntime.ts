import type { CodeGraph as UpstreamCodeGraphInstance } from "@colbymchenry/codegraph";
import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import type { z } from "zod";

import type {
  InstrumentationProvider,
  SourceAgentBudget,
  SourceAgentEvidence,
  SourceAgentToolTrace,
} from "../../interfaces/index.js";

const DEFAULT_OUTPUT_PREVIEW_CHARS = 2_000;

// 约束层门闩：记录 AI 对异常归属的判定，供 instrumentation 查询前校验。
export interface AnomalyGate {
  strategy: string | null;
}

// 策略数据门闩：未分类或分类为 other 时，不允许查询 instrumentation。
export function instrumentationGateError(gate: AnomalyGate): { error: string } | null {
  if (!gate.strategy) {
    return {
      error:
        "已阻止：请先检查 observe/source 上下文，再调用 classifyAnomaly，之后才能查询 instrumentation 决策。",
    };
  }
  if (gate.strategy === "other") {
    return {
      error:
        "已阻止：异常已分类为 'other'，请继续源码探索，不要查询 instrumentation 决策。",
    };
  }
  return null;
}

// 已知策略路径门闩：分类为已知策略后，必须先真正读取 instrumentation 记录，再继续回到源码搜索。
export function sourceSearchGateError(context: SourceToolContext): { error: string } | null {
  const blocked = instrumentationGateError(context.anomalyGate);
  if (blocked || !context.anomalyGate.strategy || context.anomalyGate.strategy === "other") {
    return null;
  }
  if (!context.instrumentationProvider) {
    return null;
  }
  const instrumentationReadCount = context.toolTrace.filter(
    (trace) =>
      trace.toolName === "searchInstrumentation" && trace.input.mode === "read",
  ).length;
  if (instrumentationReadCount > 0) {
    return null;
  }
  return {
    error:
      `已阻止：异常已分类为 '${context.anomalyGate.strategy}'。请先使用 searchInstrumentation 的 mode='list' 找到决策点，再用 mode='read' 真正读取策略记录，确认定位后再继续源码搜索。`,
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
  const previewChars =
    context.budget?.maxToolTracePreviewChars ?? DEFAULT_OUTPUT_PREVIEW_CHARS;
  const trace = {
    toolName,
    input,
    outputPreview: output.slice(0, previewChars),
  };
  context.toolTrace.push(trace);
  context.onToolCall?.(trace);
  return output;
}
