import type { StructuredToolInterface } from "@langchain/core/tools";
import { INSTRUMENTATION_STRATEGY_IDS } from "@codify/converters";
import { z } from "zod";

import { buildCodeGraphContext, inspectCodeGraphNode } from "./codeGraphTools.js";
import { createReadFileRangeTool } from "./readFileRangeTool.js";
import { createJsonTool, anomalyGateError, type SourceToolContext } from "./toolRuntime.js";
import { normalizeIncludeDirs } from "../utils/path.js";

const MAX_LISTED_FILES = 200;

// 异常归属的封闭候选集：6 个现有策略 + other，AI 必须先判定为其一才能继续搜索。
const ANOMALY_STRATEGY_VALUES = [...INSTRUMENTATION_STRATEGY_IDS, "other"] as [string, ...string[]];

const schemas = {
  classifyAnomaly: z.object({
    strategy: z.enum(ANOMALY_STRATEGY_VALUES),
    rationale: z.string().min(1),
  }),
  exploreSource: z.object({
    query: z.string().min(1),
    inspectNodeIds: z.array(z.string().min(1)).max(5).default([]),
    maxNodes: z.number().int().min(1).max(60).default(30),
    maxCodeBlocks: z.number().int().min(1).max(20).default(8),
    maxCodeBlockSize: z.number().int().min(500).max(8_000).default(2_000),
  }),
  searchInstrumentation: z.object({
    mode: z.enum(["list", "read"]).default("list"),
    strategyId: z.string().optional(),
    strategyPoint: z.string().optional(),
    query: z.string().optional(),
    limit: z.number().int().min(1).max(20).default(5),
    offset: z.number().int().min(0).default(0),
  }),
};

type ClassifyAnomalyInput = z.infer<typeof schemas.classifyAnomaly>;
type ExploreSourceInput = z.infer<typeof schemas.exploreSource>;
type SearchInstrumentationInput = z.infer<typeof schemas.searchInstrumentation>;

type ListCodeGraphFilesResult = {
  totalFiles: number;
  matchedFiles: number;
  truncated: boolean;
  includeDirs: string[];
  files: string[];
};

type ExploreSourceResult = {
  codeGraphContext: string;
  files?: ListCodeGraphFilesResult;
  inspectedNodes?: Array<{
    nodeId: string;
    result: Awaited<ReturnType<typeof inspectCodeGraphNode>>;
  }>;
};

export function createSourceTools(
  context: SourceToolContext,
): StructuredToolInterface[] {
  const tools: StructuredToolInterface[] = [
    createJsonTool(
      context,
      "classifyAnomaly",
      `Gate before any source search. Classify the observed anomaly into exactly one bucket: one of the existing algorithm strategies [${INSTRUMENTATION_STRATEGY_IDS.join(", ")}], or "other" when it does not belong to any strategy. exploreSource / readFileRange / searchInstrumentation stay locked until this is called.`,
      schemas.classifyAnomaly,
      (input) => classifyAnomaly(context, input),
    ),
    createJsonTool(
      context,
      "exploreSource",
      "Explore source with CodeGraph context inside the configured source directories. Requires classifyAnomaly first.",
      schemas.exploreSource,
      (input) => exploreSource(context, input),
    ),
    createReadFileRangeTool(context),
  ];

  // 仅当存在该节点的转换算法决策记录时，才注入 instrumentation 检索工具
  if (context.instrumentationProvider) {
    tools.push(
      createJsonTool(
        context,
        "searchInstrumentation",
        "Query the design-to-code algorithm decisions recorded for this node. Requires classifyAnomaly first. Use mode='list' to see available strategy decision points, then mode='read' with strategyId+strategyPoint to page through concrete decision records.",
        schemas.searchInstrumentation,
        (input) => searchInstrumentation(context, input),
      ),
    );
  }

  return tools;
}

// 约束层：记录异常归属判定，放行后续源码搜索。
function classifyAnomaly(
  context: SourceToolContext,
  input: ClassifyAnomalyInput,
): unknown {
  context.anomalyGate.strategy = input.strategy;
  return {
    accepted: true,
    strategy: input.strategy,
    nextStep:
      input.strategy === "other"
        ? "Anomaly is outside known strategies; proceed with exploreSource / readFileRange to locate it in source."
        : `Anomaly attributed to '${input.strategy}'. Prefer searchInstrumentation on this strategy first, then verify in source.`,
  };
}

// 门闩校验：未完成 classifyAnomaly 前拒绝任何搜索类工具。
function searchInstrumentation(
  context: SourceToolContext,
  input: SearchInstrumentationInput,
): unknown {
  const blocked = anomalyGateError(context.anomalyGate);
  if (blocked) return blocked;

  const provider = context.instrumentationProvider;
  if (!provider) {
    return { error: "No instrumentation decisions are available for this node." };
  }

  if (input.mode === "list") {
    return { strategyPoints: provider.listStrategyPoints() };
  }

  if (!input.strategyId || !input.strategyPoint) {
    return {
      error: "mode='read' requires both strategyId and strategyPoint. Call mode='list' first to discover them.",
    };
  }

  return provider.readStrategyPoint(input.strategyId, input.strategyPoint, {
    query: input.query,
    limit: input.limit,
    offset: input.offset,
  });
}

async function exploreSource(
  context: SourceToolContext,
  input: ExploreSourceInput,
): Promise<ExploreSourceResult | { error: string }> {
  const blocked = anomalyGateError(context.anomalyGate);
  if (blocked) return blocked;

  const codeGraphContext = await buildCodeGraphContext({
    graph: context.codeGraph,
    query: input.query,
    maxNodes: Math.min(input.maxNodes, context.budget?.maxGraphResults ?? 30),
    maxCodeBlocks: input.maxCodeBlocks,
    maxCodeBlockSize: input.maxCodeBlockSize,
  });

  return {
    codeGraphContext,
    // 文件结构
    files: listFiles(context),
    // 关系图谱
    inspectedNodes:
      input.inspectNodeIds.length > 0
        ? await Promise.all(
            input.inspectNodeIds.map(async (nodeId) => ({
              nodeId,
              result: await inspectCodeGraphNode({
                graph: context.codeGraph,
                nodeId,
              }),
            })),
          )
        : undefined,
  };
}

function listFiles(
  context: SourceToolContext,
): ListCodeGraphFilesResult {
  const includeDirs = normalizeIncludeDirs(context.includeDirs);
  const files = context.codeGraph
    .getFiles()
    .filter((file) => isIncludedFile(file.path, includeDirs))
    .map((file) => file.path)
    .sort((left, right) => left.localeCompare(right));
  const limitedFiles = files.slice(0, MAX_LISTED_FILES);

  return {
    totalFiles: context.codeGraph.getStats().fileCount,
    matchedFiles: files.length,
    truncated: limitedFiles.length < files.length,
    includeDirs,
    files: limitedFiles,
  };
}

function isIncludedFile(filePath: string, includeDirs: string[]): boolean {
  return includeDirs.length === 0
    ? true
    : includeDirs.some((dir) => filePath === dir || filePath.startsWith(`${dir}/`));
}
