import { HumanMessage } from "@langchain/core/messages";

// 构造初始提问消息，约束模型以只读方式在源码范围内做证据驱动的探索。
export function createSourceQuestionMessage(question: string): HumanMessage {
  return new HumanMessage({
    content: [
      "请通过工具自主检查仓库，回答下面的源码问题。",
      "遇到架构、流程、功能或实现机制问题时，优先使用 exploreSource。",
      "调用方已经配置好可分析源码范围；你只需要决定搜索什么，不需要决定去哪里搜。",
      "exploreSource 已经会返回索引文件结构，不要额外传文件列表控制参数。",
      "只有当 CodeGraph 上下文需要实时源码证据补充时，才使用 readFileRange。",
      "最终回答必须简洁、基于证据，并尽量引用文件路径和行号范围。",
      "",
      "<question>",
      question,
      "</question>",
    ].join("\n"),
  });
}
