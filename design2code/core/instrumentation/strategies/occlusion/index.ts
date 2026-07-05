import { createNodeDecision, createOccluderDecision } from "./evidence.js";
import type { OcclusionStrategyState } from "./model.js";
import { createOcclusionPacket } from "./packet.js";
import type {
  OcclusionAiPacket,
  OcclusionNodeEvaluationInput,
  OcclusionOccluderEvaluationInput,
  OcclusionStageSummary,
} from "./types.js";

export type {
  OcclusionAiPacket,
  OcclusionNodeEvaluationInput,
  OcclusionOccluderEvaluationInput,
  OcclusionStageSummary,
} from "./types.js";

export class OcclusionInstrumentationStrategy {
  private state: OcclusionStrategyState = {
    inputNodeCount: 0,
    skippedInvalidGeometryCount: 0,
    decisions: [],
    occluderDecisions: [],
    acceptedOccluders: [],
    latestPacket: null,
  };

  startStage(inputNodeCount: number): void {
    this.state.inputNodeCount = inputNodeCount;
    this.state.skippedInvalidGeometryCount = 0;
    this.state.decisions = [];
    this.state.occluderDecisions = [];
    this.state.acceptedOccluders = [];
    this.state.latestPacket = null;
  }

  recordInvalidGeometry(): void {
    this.state.skippedInvalidGeometryCount += 1;
  }

  recordNodeEvaluation(input: OcclusionNodeEvaluationInput): void {
    this.state.decisions.push(createNodeDecision(input, this.state.acceptedOccluders));
  }

  recordOccluderEvaluation(input: OcclusionOccluderEvaluationInput): void {
    const decision = createOccluderDecision(input);
    this.state.occluderDecisions.push(decision);
    if (input.isOpaque) {
      this.state.acceptedOccluders.push({
        node: input.node,
        rect: input.rect,
        opaqueDecision: decision.opaqueDecision,
      });
    }
  }

  finish(outputNodeCount: number): OcclusionAiPacket {
    this.state.latestPacket = createOcclusionPacket(this.state, outputNodeCount);
    return this.state.latestPacket;
  }

  getPacket(): OcclusionAiPacket | null {
    return this.state.latestPacket;
  }
}
