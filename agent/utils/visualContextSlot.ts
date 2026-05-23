import { HumanMessage } from "@langchain/core/messages";
import { toPngDataUrl } from "../steps/utils/common.js";

export interface VisualContextSlotInput {
  baselinePngBase64: string;
  currentPngBase64: string;
  diffPngBase64: string;
  rewriteRounds?: number;
  diffRatio?: number;
}


export function buildVisualContextMessage(
  input: VisualContextSlotInput
): HumanMessage {
  const roundDesc =
    typeof input.rewriteRounds === "number" && input.rewriteRounds > 0
      ? `（已完成 ${input.rewriteRounds} 轮 rewrite）`
      : "（初始状态，尚未 rewrite）";

  const metrics =
    typeof input.diffRatio === "number"
      ? `diffRatio=${input.diffRatio.toFixed(6)}`
      : "";

  return new HumanMessage({
    content: [
      {
        type: "text",
        text: [
          "下面三张图是本次视觉回归任务的共享视觉上下文：",
          "1) baseline —— Figma 设计稿渲染图，视为唯一真理，永远保持不变",
          "2) current  —— 当前 HTML 渲染出来的截图",
          "3) diff     —— current 与 baseline 的像素级差异图，高亮处 = 差异位置",
          roundDesc,
          metrics,
        ]
          .filter(Boolean)
          .join("\n"),
      },
      { type: "image_url", image_url: { url: toPngDataUrl(input.baselinePngBase64) } },
      { type: "image_url", image_url: { url: toPngDataUrl(input.currentPngBase64) } },
      { type: "image_url", image_url: { url: toPngDataUrl(input.diffPngBase64) } },
    ],
  });
}
