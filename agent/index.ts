import { PNG } from "pngjs";
import { createLLM } from "./llm/createLLM.js";
import { diffPng } from "./utils/diffPng.js";
import type {
  RunVisualRepairParams,
  VisualDiffParams,
  VisualRegressionConfig,
} from "./interfaces/runtime.js";
import { runVisualRepairLoop } from "./runtime/loop.js";

// 从 PNG base64 中解析出真实的宽高，避免调用方手动传入导致与 baseline 尺寸错位
function readPngSize(base64: string): { width: number; height: number } {
  const { width, height } = PNG.sync.read(Buffer.from(base64, "base64"));
  return { width, height };
}

export function visualDiff(params: VisualDiffParams) {
  const {
    baselinePngBase64,
    currentPngBase64,
    html,
    model,
    apiKey,
    baseUrl,
    temperature,
    threshold,
    renderEndpoint,
    targetSimilarity,
    viewportWidth,
    viewportHeight,
  } = params;

  const diff = diffPng(baselinePngBase64, currentPngBase64, threshold);

  // 视口默认对齐到 baseline 真实尺寸，保证 rewrite 后重新渲染出来的截图也能与 baseline 做像素级 diff
  const baselineSize = readPngSize(baselinePngBase64);
  const visualRegression: VisualRegressionConfig = {
    renderEndpoint: renderEndpoint ?? "http://localhost:3001/api/render/html",
    targetSimilarity: targetSimilarity ?? 0.95,
    viewportWidth: viewportWidth ?? baselineSize.width,
    viewportHeight: viewportHeight ?? baselineSize.height,
    diffThreshold: threshold,
  };

  const runParams = {
    baselinePngBase64,
    currentPngBase64,
    diffPngBase64: diff.diffBase64,
    diffRatio: diff.diffRatio,
    html,
    model,
    apiKey,
    baseUrl,
    temperature,
    visualRegression,
  } satisfies RunVisualRepairParams;

  const llm = createLLM({
    model,
    apiKey,
    baseUrl,
    temperature,
  });

  return runVisualRepairLoop(llm, runParams);
}
