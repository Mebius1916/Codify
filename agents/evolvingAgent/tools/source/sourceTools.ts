import type { StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

import { buildCodeGraphContext, inspectCodeGraphNode } from "./codeGraphTools.js";
import { INSTRUMENTATION_STRATEGY_IDS } from "./instrumentationStrategyIds.js";
import { createReadFileRangeTool } from "./readFileRangeTool.js";
import {
  createJsonTool,
  instrumentationGateError,
  sourceSearchGateError,
  type SourceToolContext,
} from "../runtime/toolRuntime.js";
import { normalizeIncludeDirs } from "../../utils/path.js";

const DEFAULT_MAX_LISTED_FILES = 200;

// 异常归属的封闭候选集：6 个现有策略 + other，AI 在查询策略数据前必须判定为其一。
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
  error?: string;
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
      `在检查 observe/source 上下文后，对异常进行归类。必须从现有算法策略 [${INSTRUMENTATION_STRATEGY_IDS.join(", ")}] 中选择一个；如果都不属于，则选择 "other"。只有分类为已知策略后，searchInstrumentation 才会解锁。`,
      schemas.classifyAnomaly,
      (input) => classifyAnomaly(context, input),
    ),
    createJsonTool(
      context,
      "exploreSource",
      "在已配置的源码目录内使用 CodeGraph 上下文探索源码。需要源码上下文来判断策略归属时，应在 classifyAnomaly 之前使用；若已分类为已知策略且存在 instrumentation，则必须先完成 searchInstrumentation mode='read'，再继续源码搜索。",
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
        "查询当前节点记录的 design-to-code 算法决策。必须先调用 classifyAnomaly，且分类必须是已知策略而不是 'other'。先用 mode='list' 查看已分类策略的决策点，再用 mode='read' 结合 strategyId+strategyPoint 阅读记录。",
        schemas.searchInstrumentation,
        (input) => searchInstrumentation(context, input),
      ),
    );
  }

  return tools;
}

// 约束层：记录异常归属判定，决定是否允许查询具体策略数据。
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
        ? "异常不属于现有策略；请继续使用 exploreSource / readFileRange 在源码中定位。"
        : `异常已归因到 '${input.strategy}'；请先使用 searchInstrumentation 的 mode='list' 查看决策点，再用 mode='read' 真正读取策略记录，确认定位后再回到源码验证。`,
  };
}

// 策略数据门闩：只有完成具体策略分类后，才允许查询 instrumentation。
function searchInstrumentation(
  context: SourceToolContext,
  input: SearchInstrumentationInput,
): unknown {
  const blocked = instrumentationGateError(context.anomalyGate);
  if (blocked) return blocked;

  const provider = context.instrumentationProvider;
  if (!provider) {
    return { error: "当前节点没有可用的 instrumentation 决策记录。" };
  }

  if (input.mode === "list") {
    return {
      strategyPoints: provider
        .listStrategyPoints()
        .filter((item) => item.strategyId === context.anomalyGate.strategy),
    };
  }

  if (!input.strategyId || !input.strategyPoint) {
    return {
      error: "mode='read' 需要同时提供 strategyId 和 strategyPoint。请先调用 mode='list' 查看可用项。",
    };
  }
  if (input.strategyId !== context.anomalyGate.strategy) {
    return {
      error: `当前已分类策略是 '${context.anomalyGate.strategy}'，但请求查询 '${input.strategyId}'。只能查询已分类策略。`,
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
): Promise<ExploreSourceResult> {
  const blocked = sourceSearchGateError(context);
  if (blocked) {
    return { error: blocked.error, codeGraphContext: "" };
  }

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
  const maxListedFiles = context.budget?.maxListedFiles ?? DEFAULT_MAX_LISTED_FILES;
  const includeDirs = normalizeIncludeDirs(context.includeDirs);
  const files = context.codeGraph
    .getFiles()
    .filter((file) => isIncludedFile(file.path, includeDirs))
    .map((file) => file.path)
    .sort((left, right) => left.localeCompare(right));
  const limitedFiles = files.slice(0, maxListedFiles);

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
