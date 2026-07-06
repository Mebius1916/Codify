import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import { normalizeIncludeDirs } from "../../utils/path.js";

const PROFILE_FILES = [
  "AGENTS.md",
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "vite.config.ts",
  "nest-cli.json",
];

export async function createRepoProfile(params: {
  repoRoot: string;
  includeDirs?: string[];
  codeGraphSummary: string;
}): Promise<string> {
  const repoRoot = resolve(params.repoRoot);
  const includeDirs = normalizeIncludeDirs(params.includeDirs);
  const rootEntries = await readdir(repoRoot, { withFileTypes: true }).catch(
    () => [],
  );
  const topLevel = rootEntries
    .filter(
      (entry) => !entry.name.startsWith(".") && entry.name !== "node_modules",
    )
    .map((entry) => `${entry.isDirectory() ? "dir " : "file"} ${entry.name}`)
    .sort()
    .slice(0, 80);
  const fileSections = await Promise.all(
    PROFILE_FILES.filter((filePath) =>
      existsSync(join(repoRoot, filePath)),
    ).map(async (filePath) => {
      const content = await readFile(join(repoRoot, filePath), "utf8");
      return [`## ${filePath}`, trimProfileContent(content)].join("\n");
    }),
  );

  return [
    "# 仓库画像",
    `仓库根目录: ${repoRoot.split(sep).join("/")}`,
    `可分析目录: ${includeDirs.length > 0 ? includeDirs.join(", ") : "."}`,
    "",
    "## 顶层目录结构",
    ...topLevel,
    "",
    "## CodeGraph 摘要",
    params.codeGraphSummary,
    "",
    ...fileSections,
  ].join("\n");
}

function trimProfileContent(content: string): string {
  const maxChars = 6_000;
  if (content.length <= maxChars) {
    return content;
  }

  return `${content.slice(0, maxChars)}\n[仓库画像内容已截断]`;
}
