import { createMiddleware, type AnyAgentMiddleware } from "langchain";

import type {
  SourceAgentEvidence,
  SourceAgentProgressEvent,
  SourceAgentToolTrace,
} from "../../interfaces/index.js";
import type { AnomalyGate } from "../../tools/runtime/toolRuntime.js";

const MAX_NO_PROGRESS_ROUNDS = 2;

type LoopStopReason =
  | "known_strategy_verified"
  | "known_strategy_missing_instrumentation"
  | "other_verified"
  | "no_progress";

type ProgressSnapshot = {
  classification: string | null;
  evidenceCount: number;
  instrumentationReadCount: number;
  exploreQueryCount: number;
};

type LoopStopDecision = {
  shouldStop: boolean;
  reason?: LoopStopReason;
};

type LoopTerminationInput = {
  evidence: SourceAgentEvidence[];
  toolTrace: SourceAgentToolTrace[];
  anomalyGate: AnomalyGate;
  hasInstrumentation: boolean;
  onProgress?: (event: SourceAgentProgressEvent) => void;
};

// 创建 loop 终止中间件：当结论已具备证据，或连续两轮没有新增有效进展时，强制进入最终收敛回答。
export function createLoopTerminationMiddleware(input: LoopTerminationInput) {
  let previousSnapshot: ProgressSnapshot = createProgressSnapshot(input);
  let observedToolCallCount = 0;
  let noProgressRounds = 0;
  let hasForcedFinalTurn = false;

  return createMiddleware({
    name: "sourceLoopTermination",
    wrapModelCall: async (request, handler) => {
      if (hasForcedFinalTurn) {
        return handler(request);
      }
      if (!shouldEvaluateLoopStop(request)) {
        return handler(request);
      }

      const currentToolCallCount = input.toolTrace.length;
      if (currentToolCallCount > observedToolCallCount) {
        const currentSnapshot = createProgressSnapshot(input);
        noProgressRounds = hasSnapshotProgress(previousSnapshot, currentSnapshot)
          ? 0
          : noProgressRounds + 1;
        previousSnapshot = currentSnapshot;
        observedToolCallCount = currentToolCallCount;
      }

      const decision = decideLoopStop(input, noProgressRounds);
      if (!decision.shouldStop || !decision.reason) {
        return handler(request);
      }

      hasForcedFinalTurn = true;
      input.onProgress?.({
        event: "evolvingAgent.stopRequested",
        details: buildStopDetails(input, decision.reason, noProgressRounds),
      });

      return handler({
        ...request,
        tools: [],
        toolChoice: "none",
        systemMessage: request.systemMessage.concat(
          `\n\n${buildStopPrompt(input, decision.reason, noProgressRounds)}`,
        ),
      });
    },
  }) as AnyAgentMiddleware;
}

// 生成当前调查进度快照，只保留 stop 判定真正需要的最小指标。
function createProgressSnapshot(input: LoopTerminationInput): ProgressSnapshot {
  return {
    classification: input.anomalyGate.strategy,
    evidenceCount: input.evidence.length,
    instrumentationReadCount: countInstrumentationReads(input.toolTrace),
    exploreQueryCount: countUniqueExploreQueries(input.toolTrace),
  };
}

// 判断本轮是否出现了新的有效进展。
function hasSnapshotProgress(
  previousSnapshot: ProgressSnapshot,
  currentSnapshot: ProgressSnapshot,
): boolean {
  return (
    previousSnapshot.classification !== currentSnapshot.classification ||
    previousSnapshot.evidenceCount !== currentSnapshot.evidenceCount ||
    previousSnapshot.instrumentationReadCount !== currentSnapshot.instrumentationReadCount ||
    previousSnapshot.exploreQueryCount !== currentSnapshot.exploreQueryCount
  );
}

// 根据最小规则集判断当前 loop 是否应当收敛结束。
function decideLoopStop(
  input: LoopTerminationInput,
  noProgressRounds: number,
): LoopStopDecision {
  const strategy = input.anomalyGate.strategy;
  const evidenceCount = input.evidence.length;
  const instrumentationReadCount = countInstrumentationReads(input.toolTrace);
  const toolCallsAfterClassification = countToolCallsAfterClassification(
    input.toolTrace,
    strategy,
  );

  if (strategy === "other" && evidenceCount >= 1) {
    return { shouldStop: true, reason: "other_verified" };
  }

  if (
    strategy &&
    strategy !== "other" &&
    input.hasInstrumentation &&
    instrumentationReadCount === 0 &&
    toolCallsAfterClassification >= 3
  ) {
    return { shouldStop: true, reason: "known_strategy_missing_instrumentation" };
  }

  if (
    strategy &&
    strategy !== "other" &&
    evidenceCount >= 1 &&
    (!input.hasInstrumentation || instrumentationReadCount >= 1)
  ) {
    return { shouldStop: true, reason: "known_strategy_verified" };
  }

  if (
    noProgressRounds >= MAX_NO_PROGRESS_ROUNDS &&
    canStopForNoProgress(input)
  ) {
    return { shouldStop: true, reason: "no_progress" };
  }

  return { shouldStop: false };
}

// 统计已实际读取的 instrumentation 记录次数，list 目录浏览不计入有效验证。
function countInstrumentationReads(toolTrace: SourceAgentToolTrace[]): number {
  return toolTrace.filter(
    (trace) =>
      trace.toolName === "searchInstrumentation" && trace.input.mode === "read",
  ).length;
}

// 统计 exploreSource 的唯一查询数；新的搜索意图也算有效进展，避免过早判成 no_progress。
function countUniqueExploreQueries(toolTrace: SourceAgentToolTrace[]): number {
  return new Set(
    toolTrace
      .filter((trace) => trace.toolName === "exploreSource")
      .map((trace) => String(trace.input.query ?? "").trim())
      .filter(Boolean),
  ).size;
}

// 只在真正的 agent 工具轮次上判定 stop，避免把上下文压缩摘要调用误记成终止。
function shouldEvaluateLoopStop(request: {
  tools?: unknown;
  toolChoice?: unknown;
}): boolean {
  if (request.toolChoice === "none") {
    return false;
  }
  return Array.isArray(request.tools) && request.tools.length > 0;
}

// no_progress 只在已经有调查沉淀后才生效；前两次 exploreSource 不应直接终止。
function canStopForNoProgress(input: LoopTerminationInput): boolean {
  return (
    Boolean(input.anomalyGate.strategy) ||
    input.evidence.length > 0 ||
    countInstrumentationReads(input.toolTrace) > 0 ||
    countUniqueExploreQueries(input.toolTrace) >= 3
  );
}

// 生成终止事件的调试明细，便于后端日志看到 agent 为何收敛。
function buildStopDetails(
  input: LoopTerminationInput,
  reason: LoopStopReason,
  noProgressRounds: number,
): Record<string, unknown> {
  return {
    reason,
    classification: input.anomalyGate.strategy,
    evidenceCount: input.evidence.length,
    instrumentationReadCount: countInstrumentationReads(input.toolTrace),
    toolCallCount: input.toolTrace.length,
    noProgressRounds,
  };
}

// 生成最终收敛提示，强制模型停止继续调工具，改为基于现有证据输出最终回答。
function buildStopPrompt(
  input: LoopTerminationInput,
  reason: LoopStopReason,
  noProgressRounds: number,
): string {
  const reasonText =
    reason === "known_strategy_verified"
      ? "已完成“已知策略 + instrumentation + 源码证据”的闭环。"
      : reason === "known_strategy_missing_instrumentation"
        ? "已完成已知策略分类，但迟迟没有真正读取 instrumentation 记录；请停止继续扩散搜索，并明确说明当前缺少的策略证据。"
      : reason === "other_verified"
        ? "异常已归类为 other，且已有源码证据支撑结论。"
        : `连续 ${noProgressRounds} 轮没有新增有效进展，请停止继续搜索。`;

  return [
    "现在进入最终收敛阶段。",
    `终止原因：${reasonText}`,
    `当前分类：${input.anomalyGate.strategy ?? "未分类"}`,
    `源码证据数：${input.evidence.length}`,
    `instrumentation 读取数：${countInstrumentationReads(input.toolTrace)}`,
    "禁止再调用任何工具，直接基于现有消息、instrumentation 记录和 readFileRange 证据生成最终回答。",
    "如果证据仍不足，请明确写出剩余不确定点；不要假装已经验证未读取的文件。",
  ].join("\n");
}

// 统计分类完成后又发生了多少次工具调用；已知策略路径若迟迟不读 instrumentation，应尽快终止并暴露缺口。
function countToolCallsAfterClassification(
  toolTrace: SourceAgentToolTrace[],
  strategy: string | null,
): number {
  if (!strategy) {
    return 0;
  }
  const classifyIndex = toolTrace.findIndex(
    (trace) =>
      trace.toolName === "classifyAnomaly" && trace.input.strategy === strategy,
  );
  return classifyIndex < 0 ? 0 : toolTrace.length - classifyIndex - 1;
}
