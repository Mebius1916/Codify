import type { StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

import { buildCodeGraphContext, inspectCodeGraphNode } from "./codeGraphTools.js";
import { createReadFileRangeTool } from "./readFileRangeTool.js";
import { createJsonTool, type SourceToolContext } from "./toolRuntime.js";
import { normalizeIncludeDirs } from "../utils/path.js";

const MAX_LISTED_FILES = 200;

const schemas = {
  exploreSource: z.object({
    query: z.string().min(1),
    inspectNodeIds: z.array(z.string().min(1)).max(5).default([]),
    maxNodes: z.number().int().min(1).max(60).default(30),
    maxCodeBlocks: z.number().int().min(1).max(20).default(8),
    maxCodeBlockSize: z.number().int().min(500).max(8_000).default(2_000),
  }),
};

type ExploreSourceInput = z.infer<typeof schemas.exploreSource>;

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
  return [
    createJsonTool(
      context,
      "exploreSource",
      "Explore source with CodeGraph context inside the configured source directories.",
      schemas.exploreSource,
      (input) => exploreSource(context, input),
    ),
    createReadFileRangeTool(context),
  ];
}

async function exploreSource(
  context: SourceToolContext,
  input: ExploreSourceInput,
): Promise<ExploreSourceResult> {
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
