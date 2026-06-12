import { HumanMessage, type BaseMessage } from "@langchain/core/messages";

import { observeVisualSystemPrompt } from "../../prompts/observe.js";
import type { VisualRepairContext } from "../../runtime/loop.js";
import { toPngDataUrl } from "./common.js";

export function buildObserveInstruction(currentHtml: string): string {
  return [
    observeVisualSystemPrompt,
    "",
    "===== 本步任务 =====",
    "请基于 visual evidence sheet 和下面的当前参考代码，只输出结构化 groups。",
    "",
    "## 当前参考代码",
    currentHtml,
  ].join("\n");
}

export function buildObserveVisualContextMessage(
  ctx: VisualRepairContext,
): BaseMessage[] {
  return [
    new HumanMessage({
      content: [
        {
          type: "text",
          text: [
            "下面是 observe 阶段的视觉上下文：",
            "visual evidence sheet 是由 Figma baseline 生成的单张证据图，视为唯一正确视觉状态",
            "上方 overview 显示整页位置关系，彩色外环只用于标出候选关注区域",
            "下方 crop 面板显示候选区域的放大 baseline 细节；crop 内部像素未被标注覆盖",
            "同色边框表示 overview 区域与 crop 面板的对应关系；不要把边框、留白或证据图排版当作原始设计内容",
          ].join("\n"),
        },
        { type: "text", text: "visual evidence sheet:" },
        {
          type: "image_url",
          image_url: { url: toPngDataUrl(ctx.input.visualEvidencePngBase64) },
        },
      ],
    }),
  ];
}
