export interface AgentProgressEvent {
  event: string;
  details?: Record<string, unknown>;
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
  abortSignal?: AbortSignal;
}
