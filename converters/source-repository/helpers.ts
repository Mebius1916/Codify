import { resolve } from "node:path";

import type { LocalSourceFileInput, LocalSourceReadRange } from "./types.js";

export function normalizeSourceFiles(
  files: LocalSourceFileInput[],
): LocalSourceFileInput[] {
  const byPath = new Map<string, LocalSourceFileInput>();

  for (const file of files) {
    const filePath = file.filePath.trim();
    if (!isSafeRepoRelativePath(filePath)) {
      throw new Error(`Unsafe source file path: ${file.filePath}`);
    }
    byPath.set(filePath, {
      filePath,
      content: file.content,
    });
  }

  return [...byPath.values()].sort((left, right) =>
    left.filePath.localeCompare(right.filePath),
  );
}

export function resolveLocalFilePath(
  localRepoRoot: string,
  filePath: string,
): string {
  const absolutePath = resolve(localRepoRoot, filePath);
  if (absolutePath !== localRepoRoot && !absolutePath.startsWith(`${localRepoRoot}/`)) {
    throw new Error(`Source file escapes local repo root: ${filePath}`);
  }
  return absolutePath;
}

export function sliceLines(
  content: string,
  startLine: number,
  endLine: number,
  maxLines: number,
): LocalSourceReadRange {
  const lines = content.split(/\r?\n/);
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

export function createSourceVersion(previousVersion: number | undefined): number {
  const timestamp = Date.now();
  return previousVersion === undefined
    ? timestamp
    : Math.max(timestamp, previousVersion + 1);
}

export function encodeRepoId(repoId: string): string {
  return encodeURIComponent(repoId);
}

export function isSafeRepoRelativePath(filePath: string): boolean {
  return (
    filePath.length > 0 &&
    !filePath.startsWith("/") &&
    !filePath.includes("\\") &&
    !filePath.split("/").includes("..")
  );
}

