import type { SourceInsightStartInput } from './sourceInsightTypes.ts'

// 构造 sourceInsight 的调查提示词。
export function buildSourceInsightPrompt(input: SourceInsightStartInput): string {
  return [
    '你是源码分析 agent。请根据下面 visual observe 阶段的观察结果，静默分析源码中最可能相关的实现位置，并给出给后续修复阶段参考的工程建议。',
    '',
    '要求：',
    '- 只分析源码，不修改代码。',
    '- 优先指出相关文件、函数、数据流和可能影响视觉差异的实现点。',
    '- 输出简洁建议，适合作为后台分析意见存入数据库。',
    '- 如果证据不足，明确说明不确定点。',
    '- 最多做少量高价值源码探索，拿到可用建议后立即停止，不要穷尽整个仓库。',
    '- 可分析源码范围已经固定为 design2code，只需要决定搜索什么，不需要决定去哪里搜。',
    '- 优先围绕 observe 中的视觉问题类型搜索 HTML 生成、CSS 生成、布局、文本、图片、样式提取相关实现。',
    '- 每个主要结论必须至少有一个 readFileRange 证据支撑，并引用文件路径与行号。',
    '- 先根据 observe 做少量源码搜索，读到足够上下文后再调用 classifyAnomaly，把该异常归入“现有算法策略之一”或 “other”（不属于任何策略时）。',
    '- 若分类为现有策略且提供了 searchInstrumentation 工具，必须先查询该策略在该节点上的决策记录（先 mode="list" 看该策略有哪些决策点，再尽快用 mode="read" 逐条阅读），确认定位后再用 readFileRange 到源码验证。',
    '- 若分类为 other，不要查询 searchInstrumentation，继续通过 exploreSource / readFileRange 搜索源码并得出结论。',
    '- 只通过 exploreSource 看到但没有 readFileRange 验证过的文件，只能放入“待验证候选方向”，不能写成确定结论。',
    '- 最终回答请分为“已验证结论”和“待验证候选方向”。',
    '',
    `<figmaNode fileKey="${input.nodeRef.fileKey}" nodeId="${input.nodeRef.nodeId}" />`,
    '',
    '<observe>',
    JSON.stringify(input.observe, null, 2),
    '</observe>',
  ].join('\n')
}
