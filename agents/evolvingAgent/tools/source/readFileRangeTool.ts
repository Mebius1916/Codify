import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { tool, type StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

import { isSafeRepoRelativePath } from "../../utils/path.js";
import {
  sourceSearchGateError,
  traceTool,
  type SourceToolContext,
} from "../runtime/toolRuntime.js";

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
      description: "当 CodeGraph 上下文需要实时验证时，读取一个聚焦的源码行范围。若已分类为已知策略且存在 instrumentation，则必须先完成 searchInstrumentation mode='read'，再读取源码。",
      schema: readFileRangeSchema,
    },
  );
}

async function readRangeWithEvidence(context: SourceToolContext, input: ReadFileRangeInput): Promise<string> {
  const blocked = sourceSearchGateError(context);
  if (blocked) {
    return blocked.error;
  }

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
    `文件路径: ${input.filePath}`,
    `行号范围: ${result.startLine}-${result.endLine}`,
    `是否截断: ${result.truncated}`,
    "内容:",
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
    throw new Error(`不安全的文件路径：${filePath}`);
  }
  const absolutePath = resolve(repoRoot, filePath);
  if (!absolutePath.startsWith(resolve(repoRoot))) {
    throw new Error(`路径逃逸仓库根目录：${filePath}`);
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
