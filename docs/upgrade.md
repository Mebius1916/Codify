  后续真正值得优化的点，我建议按优先级看：

  **1. 完成并验证 `searchSemanticSummaries`**

  现在语义缓存已经能写，但要让它真正参与搜索，需要稳定的 summary 搜索工具。

  目标：

  ```text
  用户问“哪里负责生成代码摘要？”
    -> searchSemanticSummaries("生成代码摘要")
    -> 找到 semanticSummary.ts / semanticSummaryCache.ts 相关 symbol
  ```

  需要做完：

  - FTS5 搜索稳定性验证
  - 空缓存时优雅返回
  - 搜索结果格式控制
  - prompt 里明确什么时候用它

  这是语义层能否发挥价值的关键。

  **2. 完成 `listCodeGraphFiles`**

  这个工具用来给模型文件结构视野。

  目标：

  ```text
  listCodeGraphFiles({ filter: "runtime" })
  ```

  返回：

  ```text
  runtime/answer.ts
  runtime/sourceExplorerPrompt.ts
  runtime/semanticSummaryCache.ts
  ...
  ```

  最好附带：

  ```text
  language
  nodeCount
  cachedSummaryCount
  top summaries
  ```

  后续还可以升级成：

  ```text
  带文件职责摘要的代码地图
  ```

  **3. 设计 file-level semantic summary**

  现在 summary 是 symbol 级别：

  ```text
  函数/类/方法摘要
  ```

  但 `listCodeGraphFiles` 需要的是文件级职责：

  ```text
  answer.ts：编排一次 agent run
  semanticSummaryCache.ts：持久化 symbol semantic summaries
  sourceExplorerPrompt.ts：构建系统提示词
  ```

  建议后续加：

  ```text
  file_semantic_summaries
  ```

  不要强行从 symbol summaries 拼文件职责。

  **4. 增加 evidence policy**

  现在模型最终回答是否有证据，主要靠 prompt 约束。

  后续应该有硬策略：

  ```text
  如果答案引用源码结论，但 evidence 为空：
    -> 要么自动要求 readFileRange
    -> 要么返回 low confidence / insufficient evidence
  ```

  成熟版结果应该包含：

  ```ts
  confidence: "high" | "medium" | "low";
  uncertainty: string[];
  ```

  **5. includeDirs 权限边界**

  现在 `includeDirs` 主要进入 repo profile，但 CodeGraph 搜索仍是 repoRoot 范围。

  如果主 agent 调用子 agent 时希望限制范围，需要加硬过滤：

  ```text
  searchCodeGraph 结果过滤 includeDirs
  listCodeGraphFiles 过滤 includeDirs
  readFileRange 禁止读 includeDirs 外
  semantic summaries 过滤 includeDirs
  ```

  这是产品化必须做的。

  **6. summary 结构化**

  现在摘要是 1-3 句自然语言。

  后续可以改成结构化 JSON：

  ```ts
  {
    summary: string;
    responsibilities: string[];
    inputs: string[];
    outputs: string[];
    sideEffects: string[];
    relatedSymbols: string[];
  }
  ```

  这样 `searchSemanticSummaries` 和最终回答会更稳。

  **7. 摘要生成异步化**

  现在 `inspectCodeGraphNode` 第一次遇到没缓存的 node，会同步调用 LLM 生成 summary。

  问题：

  ```text
  inspect 变慢
  用户等待更久
  summary 失败会影响工具体验
  ```

  后续可以改成：

  ```text
  先返回 inspect 结果
  后台生成 summary
  下一次再命中
  ```

  但这会增加任务队列/生命周期复杂度，不必马上做。

  **8. 是否补 `grepText`**

  如果目标是 Claude Code-like，最终还是需要纯文本搜索。

  但优先级我会放在：

  ```text
  searchSemanticSummaries
  listCodeGraphFiles
  includeDirs hard filter
  ```

  之后。

  `grepText` 适合解决：

  ```text
  错误文案
  env key
  prompt 文本
  路由字符串
  CSS class
  JSON 字段
  ```

  **9. 上下文压缩 / 中间探索摘要**

  Claude Code-like 的一个核心能力是上下文管理。

  后续可以让 agent 每几轮工具调用后生成：

  ```text
  currentFindings
  candidateSymbols
  confirmedEvidence
  openQuestions
  ```

  避免工具结果无限堆进上下文。

  **10. 结果结构升级**

  现在返回：

  ```ts
  answer
  evidence
  toolTrace
  ```

  后续可以扩展：

  ```ts
  answer
  confidence
  evidence
  inspectedSymbols
  semanticSummariesUsed
  semanticSummariesWritten
  toolTrace
  uncertainty
  ```

  这样主 agent 更容易消费。

  **我的建议顺序**

  下一步按这个顺序做：

  ```text
  1. 完成 searchSemanticSummaries smoke test
  2. 完成 listCodeGraphFiles smoke test
  3. 加 includeDirs 硬过滤
  4. 加 evidence policy
  5. 再讨论 grepText
  ```

  这条路线最符合你现在的 CodeGraph-first 设计。

---