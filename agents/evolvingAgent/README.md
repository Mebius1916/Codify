# Evolving Agent

只读 Claude Code-like 源码探索 Agent。它不会默认把仓库或文件全量塞给模型，而是让模型通过只读工具自主检索、查询代码图谱、读取小范围证据片段，然后输出带文件证据的源码分析。

## 核心设计

```text
user question
  -> open or initialize upstream CodeGraph index
  -> build repo profile
  -> LangGraph ReAct loop
  -> exploreSource
  -> optional focused readFileRange fallback
  -> final answer with citations
```

## 目录结构

```text
index.ts                  对外导出入口
runtime/                  LangGraph Agent、CodeGraph、repo profile、系统提示
tools/                    只读源码检索工具
interfaces/               对外类型契约
llm/                      模型创建
utils/                    小型通用工具
```

## 能力边界

- 只读源码分析，不修改文件。
- 默认不全量读取文件。
- 优先使用 `@colbymchenry/codegraph` 生成的源码知识图谱。
- 重要结论必须通过 `readFileRange` 读取源码片段验证。

## 开源依赖

- `langchain` / `@langchain/core`：Agent loop 和工具编排。
- `@langchain/google-genai` / `@langchain/openai`：与 `visualAgant` 保持同版本线。
- `@colbymchenry/codegraph`：源码知识图谱、符号检索、关系上下文和代码上下文构建。
- `zod`：工具输入 schema。

## 主 Agent 调用

```ts
import { runEvolvingAgent } from "@codify/evolving-agent";

const result = await runEvolvingAgent({
  question: "Figma conversion 是在哪里处理的？",
  repoRoot: process.cwd(),
  sourceState: {
    sourceVersion: 1782350000000,
    indexVersion: 1782350000000,
    indexStatus: "ready",
  },
  includeDirs: ["backend", "design2code"],
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY ?? "",
  budget: {
    maxToolCalls: 18,
    maxReadLinesPerCall: 120,
  },
});

console.log(result.answer);
console.log(result.evidence);
```

## 线上源码状态

如果线上使用覆盖式源码数据库，不一定需要保留历史 `commitSha` / `snapshotId`，但调用 agent 前应保证源码和 CodeGraph 索引版本一致：

```text
覆盖源码 -> sourceVersion = Date.now(), indexStatus = pending
索引完成 -> indexVersion = sourceVersion, indexStatus = ready
agent 运行 -> 只接受 indexStatus=ready 且 sourceVersion=indexVersion
```

`sourceState` 不传时保持本地开发行为；传入时会做一致性检查，避免源码已更新但索引仍是旧版本。

本地可以用 `LocalSourceRepository` 模拟覆盖式源码数据库：

```ts
import { readFile } from "node:fs/promises";
import { LocalSourceRepository } from "@codify/converters";

const sourceRepository = LocalSourceRepository.inRepo(process.cwd());
const repoId = "codeFlow";

try {
  sourceRepository.overwriteFiles({
    repoId,
    files: [
      {
        filePath: "agents/evolvingAgent/runtime/index.ts",
        content: await readFile("agents/evolvingAgent/runtime/index.ts", "utf8"),
      },
    ],
  });

  const localRepoRoot = sourceRepository.getLocalRepoRoot(repoId);

  // CodeGraph 索引完成后调用。
  const sourceState = sourceRepository.markIndexReady(repoId);

  await runEvolvingAgent({
    question: "源码探索工具怎么工作？",
    repoRoot: localRepoRoot,
    sourceState,
    model: "gemini-2.5-flash",
    apiKey: process.env.GEMINI_API_KEY ?? "",
  });
} finally {
  sourceRepository.close();
}
```
