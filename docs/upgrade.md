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

## Visual repair agent 改造计划

当前问题：

```text
observe 正常
plan 基本正常
apply 需要同时理解计划、定位 DOM、修改 DOM、优化结构、输出完整 HTML
```

这导致 apply 输出面过大，容易生成畸形或空壳 HTML，例如：

```html
<div class="app-container"></div>
```

短期兜底可以防止灾难输出，但不能提高上限。真正需要调整的是阶段职责。

**建议新流程**

```text
observe
-> plan
-> apply
-> optimize
```

### 1. apply 只负责视觉修复

apply 不再承担代码优化职责。

目标：

```text
只落实 plan 里的视觉修复
不做全局重构
不做 class 命名优化
不做最终代码整理
```

后续可以把 apply 改成 scoped rewrite：

```ts
interface ScopedRewrite {
  scopeDataId: string;
  coveredDataIds: string[];
  html: string;
  reason: string;
}
```

执行方式：

```text
1. 根据 plan 的 dataIds 找到最近公共父节点
2. 只把这个局部 scope 给 LLM
3. LLM 只重写 scope HTML
4. 程序把 scope 合并回整页
5. 校验 data-id / src / 文本内容 / 结构完整性
```

这样 LLM 仍然可以做局部结构调整，例如：

```text
把 icon 移进 paragraph
调整局部 flex/inline 结构
优化局部 class
```

但不能误删整页。

### 2. 新增 optimize 阶段

新增独立步骤：

```text
optimize
```

替代当前语义不够清楚的 polish。

目标：

```text
视觉修复完成后，只做代码整理
```

允许：

```text
整理 class
减少冗余 wrapper
改善局部结构可读性
合并重复样式
```

禁止：

```text
改变视觉结果
删除 data-id
修改外部资源 src
大幅改写文本内容
把页面收缩成局部组件
重写整页布局
```

第一版可以继续使用：

```ts
interface HtmlCssResult {
  html: string;
  css: string;
}
```

后续可升级为：

```ts
interface OptimizedHtmlResult {
  html: string;
  css: string;
  changes: string[];
}
```

### 3. 必要校验

apply 和 optimize 都需要程序侧校验：

```text
输出必须是合法 HTML 片段
原有 data-id 不能大量丢失
命中 data-id 必须保留
src 必须原值保留
文本内容不能大量丢失
HTML 不能异常缩水
```

如果校验失败：

```text
回退上一版 HTML
记录失败原因
后续可局部重试
```

### 4. 推荐实施顺序

```text
1. 新增 optimizeHtml / optimize prompt / runOptimizeStep
2. runtime loop 从 polish 切换为 optimize
3. 调整 prompt：apply 只做视觉修复，optimize 只做代码优化
4. 保留 destructive rewrite 校验
5. 再把 apply 从 full rewrite 改成 scoped rewrite
6. 最后移除旧 polish 命名与文件
```

### 5. 目标状态

最终职责应该是：

```text
observe：发现视觉目标与差异
plan：决定修哪些 data-id，以及为什么修
apply：只执行视觉修复，程序控制修改边界
optimize：只做保守代码优化，不改变视觉语义
```

核心原则：

```text
LLM 可以优化代码，但不能无边界全量重写页面。
```
