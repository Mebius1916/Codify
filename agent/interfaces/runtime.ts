export interface VisualRegressionConfig {
  renderEndpoint: string;
  targetSimilarity: number;
  viewportWidth: number;
  viewportHeight: number;
  diffThreshold: number;
}

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
  visualRegression: VisualRegressionConfig;
  onProgress?: (event: AgentProgressEvent) => void;
  abortSignal?: AbortSignal;
}

export interface VisualDiffParams {
  baselinePngBase64: string;
  currentPngBase64: string;
  html: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  threshold: number;
  renderEndpoint?: string;
  targetSimilarity?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  onProgress?: (event: AgentProgressEvent) => void;
  abortSignal?: AbortSignal;
}
