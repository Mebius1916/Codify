import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

import { isSafeRepoRelativePath } from "../utils/path.js";
import { anomalyGateError, traceTool, type SourceToolContext } from "./toolRuntime.js";

const readFileRangeSchema = z.object({
  filePath: z.string().min(1),
  startLine: z.number().int().min(1),
  endLine: z.number().int().min(1),
  reason: z.string().min(1),
});

type ReadFileRangeInput = z.infer<typeof readFileRangeSchema>;

export function createReadFileRangeTool(context: SourceToolContext): StructuredToolInterface {
  return tool(
    (input: ReadFileRangeInput) =>
      traceTool(context, "readFileRange", input, () => readRangeWithEvidence(context, input)),
    {
      name: "readFileRange",
      description: "Read a focused source range only when CodeGraph context needs live verification. Requires classifyAnomaly first.",
      schema: readFileRangeSchema,
    },
  );
}

async function readRangeWithEvidence(context: SourceToolContext, input: ReadFileRangeInput): Promise<string> {
  // 约束层门闩：未完成异常分类前不允许读取源码
  const blocked = anomalyGateError(context.anomalyGate);
  if (blocked) return blocked.error;

  const result = await readFileRange(
    context.repoRoot,
    input.filePath,
    input.startLine,
    input.endLine,
    context.budget?.maxReadLinesPerCall ?? 120,
  );
  context.evidence.push({
    filePath: input.filePath,
    startLine: result.startLine,
    endLine: result.endLine,
    reason: input.reason,
    content: result.content,
  });

  return [
    `filePath: ${input.filePath}`,
    `lines: ${result.startLine}-${result.endLine}`,
    `truncated: ${result.truncated}`,
    "content:",
    result.content,
  ].join("\n");
}

async function readFileRange(
  repoRoot: string,
  filePath: string,
  startLine: number,
  endLine: number,
  maxLines: number,
): Promise<{
  startLine: number;
  endLine: number;
  content: string;
  truncated: boolean;
}> {
  if (!isSafeRepoRelativePath(filePath)) {
    throw new Error(`Unsafe file path: ${filePath}`);
  }
  const absolutePath = resolve(repoRoot, filePath);
  if (!absolutePath.startsWith(resolve(repoRoot))) {
    throw new Error(`Path escapes repo root: ${filePath}`);
  }
  const lines = (await readFile(absolutePath, "utf8")).split(/\r?\n/);
  const start = Math.min(Math.max(1, startLine), lines.length);
  const requestedEnd = Math.min(Math.max(start, endLine), lines.length);
  const end = Math.min(requestedEnd, start + maxLines - 1);

  return {
    startLine: start,
    endLine: end,
    content: lines
      .slice(start - 1, end)
      .map((line, index) => `${start + index}: ${line}`)
      .join("\n"),
    truncated: end < requestedEnd,
  };
}
