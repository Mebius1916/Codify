import { isAbsolute, sep } from "node:path";

export function normalizeIncludeDirs(includeDirs: string[] | undefined): string[] {
  return [...new Set(includeDirs ?? [])]
    .map((dir) => dir.trim())
    .filter(Boolean)
    .map((dir) => dir.replace(/^\.\//, "").replace(/\/$/, "").split(sep).join("/"))
    .filter((dir) => dir !== "." && !dir.startsWith("../") && !isAbsolute(dir));
}

export function isSafeRepoRelativePath(path: string): boolean {
  return Boolean(path) && !isAbsolute(path) && !path.startsWith("../") && path !== "..";
}
