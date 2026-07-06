import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { summarizationMiddleware } from "langchain";

import type { SourceAgentContextCompression } from "../../interfaces/index.js";

const SOURCE_INVESTIGATION_SUMMARY_PROMPT = [
  "你是源码调查上下文压缩器。",
  "请把下面的 agent 历史压缩为后续调查可继续使用的短摘要。",
  "只保留会影响后续判断的信息，不要保留重复工具输出，不要编造证据。",
  "必须优先保留：observe 问题、当前分类（若有）、已查 instrumentation 策略点、已验证源码证据路径和行号、待确认问题。",
  "输出中文，使用短列表，控制在 800 字以内。",
  "",
  "<messages>",
  "{messages}",
  "</messages>",
].join("\n");

// 创建上下文压缩中间件；配置无效时返回空数组以关闭压缩。
export function createContextCompressionMiddleware(
  model: BaseChatModel,
  config?: SourceAgentContextCompression,
) {
  const contextCompression = normalizeContextCompression(config);
  if (!contextCompression) return [];

  const compressionTriggerTokens = getCompressionTriggerTokens(contextCompression);
  return [
    summarizationMiddleware({
      model,
      trigger: {
        tokens: compressionTriggerTokens,
      },
      keep: {
        tokens: getCompressionKeepTokens(contextCompression, compressionTriggerTokens),
      },
      trimTokensToSummarize: compressionTriggerTokens,
      summaryPrefix: "以下是已压缩的源码调查上下文：",
      summaryPrompt: SOURCE_INVESTIGATION_SUMMARY_PROMPT,
    }),
  ];
}

// 归一化压缩配置，避免 env 非法值导致中间件初始化失败。
function normalizeContextCompression(
  config?: SourceAgentContextCompression,
): SourceAgentContextCompression | undefined {
  if (!config) return undefined;
  if (!Number.isFinite(config.contextWindowTokens) || config.contextWindowTokens <= 0) {
    return undefined;
  }
  const compressRatio = Number.isFinite(config.compressRatio)
    ? Math.min(Math.max(config.compressRatio, 0.1), 0.95)
    : 0.7;
  const keepRatio = Number.isFinite(config.keepRatio)
    ? Math.min(Math.max(config.keepRatio, 0.1), 0.9)
    : 0.5;
  return {
    contextWindowTokens: Math.floor(config.contextWindowTokens),
    compressRatio,
    keepRatio,
  };
}

// 计算触发压缩的 token 阈值，按可配置窗口比例执行。
function getCompressionTriggerTokens(config: SourceAgentContextCompression): number {
  return Math.max(1, Math.floor(config.contextWindowTokens * config.compressRatio));
}

// 计算压缩后保留的最近上下文长度。
function getCompressionKeepTokens(
  config: SourceAgentContextCompression,
  triggerTokens: number,
): number {
  return Math.max(1, Math.floor(triggerTokens * config.keepRatio));
}
