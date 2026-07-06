import type {
  InstrumentationSearchGroup,
  InstrumentationStrategyPointDirectory,
  SourceRepositoryState,
} from "@codify/converters";

export type InstrumentationReadOptions = {
  query?: string;
  limit?: number;
  offset?: number;
};

// agent 按需查询转换算法决策的回调契约，具体数据由调用方（后端读 DB）提供，agent 不持有全量 packets。
export interface InstrumentationProvider {
  listStrategyPoints(): InstrumentationStrategyPointDirectory[];
  readStrategyPoint(
    strategyId: string,
    strategyPoint: string,
    options?: InstrumentationReadOptions,
  ): InstrumentationSearchGroup;
}

export interface SourceAgentProgressEvent {
  event: string;
  details?: Record<string, unknown>;
}

export interface SourceAgentBudget {
  maxToolCalls?: number;
  maxReadLinesPerCall?: number;
  maxSearchResults?: number;
  maxGraphResults?: number;
  maxListedFiles?: number;
  maxToolTracePreviewChars?: number;
}

export interface SourceAgentContextCompression {
  contextWindowTokens: number;
  compressRatio: number;
  keepRatio: number;
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
  contextCompression?: SourceAgentContextCompression;
  instrumentationProvider?: InstrumentationProvider;
  onProgress?: (event: SourceAgentProgressEvent) => void;
  abortSignal?: AbortSignal;
}

export interface RunSourceAgentResult {
  answer: string;
  evidence: SourceAgentEvidence[];
  toolTrace: SourceAgentToolTrace[];
}
