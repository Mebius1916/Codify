export interface SourceAgentProgressEvent {
  event: string;
  details?: Record<string, unknown>;
}

export interface SourceAgentBudget {
  maxToolCalls?: number;
  maxReadLinesPerCall?: number;
  maxSearchResults?: number;
  maxGraphResults?: number;
}

export interface SourceAgentEvidence {
  filePath: string;
  startLine: number;
  endLine: number;
  reason: string;
  content: string;
}

export interface SourceAgentToolTrace {
  toolName: string;
  input: Record<string, unknown>;
  outputPreview: string;
}

export interface SourceRepositoryState {
  sourceVersion: number;
  indexVersion: number;
  indexStatus: "pending" | "ready" | "failed";
}

export interface RunSourceAgentInput {
  question: string;
  repoRoot: string;
  sourceState?: SourceRepositoryState;
  includeDirs?: string[];
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature?: number;
  timeout?: number;
  budget?: SourceAgentBudget;
  onProgress?: (event: SourceAgentProgressEvent) => void;
  abortSignal?: AbortSignal;
}

export interface RunSourceAgentResult {
  answer: string;
  evidence: SourceAgentEvidence[];
  toolTrace: SourceAgentToolTrace[];
}
