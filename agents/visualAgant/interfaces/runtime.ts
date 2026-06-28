export interface AgentProgressEvent {
  event: string;
  details?: Record<string, unknown>;
}

export interface VisualRepairObserveResult {
  figmaDescription: string;
  groups: Array<{
    priority: "high" | "medium" | "low";
    dataIds: string[];
    observation: string;
    acceptance: string;
  }>;
}

export interface RunVisualRepairParams {
  visualEvidencePngBase64: string;
  html: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  timeout?: number;
  onProgress?: (event: AgentProgressEvent) => void;
  onObserve?: (result: VisualRepairObserveResult) => void;
  abortSignal?: AbortSignal;
}

export interface RunVisualRepairInput {
  visualEvidencePngBase64: string;
  html: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  timeout?: number;
  onProgress?: (event: AgentProgressEvent) => void;
  onObserve?: (result: VisualRepairObserveResult) => void;
  abortSignal?: AbortSignal;
}
