# Contracts

跨包/跨进程的类型契约仓库。此包 0 依赖，只承载"没有单一 owner"的共享类型：

- `instrumentation/`：转换算法策略点的记录 / 目录 / 搜索结果类型。`design2code` 写入、`backend` 落库+检索、`evolvingAgent` 消费。
- `conversion/`：前后端转换流水线的阶段联合类型 `ConvertStage` 与 NDJSON 事件 `ConvertStageEvent`。

新增契约前请自问：这个类型是否真的没有天然的 owner？如果有单一 owner，请从该 owner 的包直接 export，而不要塞进 contracts。
