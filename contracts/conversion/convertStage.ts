// 前后端共享的转换流水线阶段联合类型。任一侧新增或修改阶段都必须同步升级消费方。
export type ConvertStage =
  | "figma_fetch"
  | "codegen"
  | "render_baseline"
  | "render_current"
  | "observe"
  | "plan"
  | "rewrite"
  | "completed"
  | "failed";

// 转换进度事件契约：后端 NDJSON 推送、前端 UI 消费共同遵循。
export interface ConvertStageEvent {
  stage: ConvertStage;
  label: string;
}
