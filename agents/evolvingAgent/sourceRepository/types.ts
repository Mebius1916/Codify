export interface SourceRepositoryState {
  sourceVersion: number;
  indexVersion: number;
  indexStatus: "pending" | "ready" | "failed";
}

export interface LocalSourceFileRecord {
  repoId: string;
  filePath: string;
  content: string;
}

export interface LocalSourceFileInput {
  filePath: string;
  content: string;
}

export interface OverwriteSourceFilesInput {
  repoId: string;
  files: LocalSourceFileInput[];
}

export interface LocalSourceReadRange {
  startLine: number;
  endLine: number;
  content: string;
  truncated: boolean;
}
