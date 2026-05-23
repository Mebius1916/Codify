export interface AgentProgressEvent {
  event: string;
  details?: Record<string, unknown>;
}

export interface RunVisualRepairParams {
  baselinePngBase64: string;
  currentPngBase64: string;
  diffPngBase64: string;
  diffRatio: number;
  html: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  onProgress?: (event: AgentProgressEvent) => void;
  abortSignal?: AbortSignal;
}

export interface RunVisualRepairInput {
  baselinePngBase64: string;
  currentPngBase64: string;
  html: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  threshold: number;
  onProgress?: (event: AgentProgressEvent) => void;
  abortSignal?: AbortSignal;
}
