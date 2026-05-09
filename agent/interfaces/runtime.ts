export interface VisualRegressionConfig {
  renderEndpoint: string;
  targetSimilarity: number;
  viewportWidth: number;
  viewportHeight: number;
  diffThreshold: number;
}

export interface AgentLogEntry {
  timestamp: string;
  level: "info" | "error";
  event: string;
  details?: Record<string, unknown>;
  message?: string;
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
}

export interface VisualDiffParams {
  baselinePngBase64: string;
  currentPngBase64: string;
  html: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
  requestTimeoutMs?: number;
  onLog?: (entry: AgentLogEntry) => void;
  threshold: number;
  renderEndpoint?: string;
  targetSimilarity?: number;
  viewportWidth?: number;
  viewportHeight?: number;
}
