import type { RunSourceAgentInput } from "../../interfaces/index.js";

// 校验源码索引状态，避免在索引未就绪或版本不一致时进入探索流程。
export function assertReadySourceState(
  sourceState: RunSourceAgentInput["sourceState"],
): void {
  if (!sourceState) return;

  if (sourceState.indexStatus !== "ready") {
    throw new Error(`源码索引尚未就绪：${sourceState.indexStatus}`);
  }

  if (sourceState.sourceVersion !== sourceState.indexVersion) {
    throw new Error(
      `源码与索引版本不一致：sourceVersion=${sourceState.sourceVersion}, indexVersion=${sourceState.indexVersion}`,
    );
  }
}
