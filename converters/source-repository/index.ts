import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { LowSync } from "lowdb";
import { JSONFileSyncPreset } from "lowdb/node";

import {
  createSourceVersion,
  encodeRepoId,
  isSafeRepoRelativePath,
  normalizeSourceFiles,
  resolveLocalFilePath,
  sliceLines,
} from "./helpers.js";
import type {
  LocalSourceFileRecord,
  LocalSourceReadRange,
  OverwriteSourceFilesInput,
  SourceRepositoryState,
} from "./types.js";

export type {
  LocalSourceFileInput,
  LocalSourceFileRecord,
  LocalSourceReadRange,
  OverwriteSourceFilesInput,
  SourceRepositoryState,
} from "./types.js";

type StoredSourceFileRecord = {
  repoId: string;
  filePath: string;
};

type LocalSourceRepositoryRecord = SourceRepositoryState & {
  repoId: string;
};

type LocalSourceDatabase = {
  repositories: LocalSourceRepositoryRecord[];
  files: StoredSourceFileRecord[];
};

const defaultDatabase: LocalSourceDatabase = {
  repositories: [],
  files: [],
};

export class LocalSourceRepository {
  private readonly database: LowSync<LocalSourceDatabase>;
  private readonly sourceRoot: string;

  constructor(databasePath: string) {
    const resolvedDatabasePath = resolve(databasePath);
    mkdirSync(dirname(resolvedDatabasePath), { recursive: true });
    this.database = JSONFileSyncPreset(resolvedDatabasePath, defaultDatabase);
    this.sourceRoot = resolve(dirname(resolvedDatabasePath), "sources");
  }

  static inRepo(repoRoot: string): LocalSourceRepository {
    const databasePath = resolve(repoRoot, ".evolving-agent", "source.json");
    return new LocalSourceRepository(databasePath);
  }

  close(): void {}

  getLocalRepoRoot(repoId: string): string {
    return resolve(this.sourceRoot, encodeRepoId(repoId));
  }

  getState(repoId: string): SourceRepositoryState | undefined {
    const record = this.database.data.repositories.find(
      (repository) => repository.repoId === repoId,
    );
    return record ? toSourceState(record) : undefined;
  }

  getFile(repoId: string, filePath: string): LocalSourceFileRecord | undefined {
    const file = this.database.data.files.find(
      (record) => record.repoId === repoId && record.filePath === filePath,
    );
    return file
      ? {
          repoId: file.repoId,
          filePath: file.filePath,
          content: readFileSync(
            resolveLocalFilePath(this.getLocalRepoRoot(repoId), file.filePath),
            "utf8",
          ),
        }
      : undefined;
  }

  overwriteFiles(input: OverwriteSourceFilesInput): SourceRepositoryState {
    const previousState = this.getState(input.repoId);
    const sourceVersion = createSourceVersion(previousState?.sourceVersion);
    const indexVersion = previousState?.indexVersion ?? 0;
    const files = normalizeSourceFiles(input.files);
    const localRepoRoot = this.getLocalRepoRoot(input.repoId);

    rmSync(localRepoRoot, { recursive: true, force: true });
    mkdirSync(localRepoRoot, { recursive: true });
    for (const file of files) {
      const absolutePath = resolveLocalFilePath(localRepoRoot, file.filePath);
      mkdirSync(dirname(absolutePath), { recursive: true });
      writeFileSync(absolutePath, file.content, "utf8");
    }

    this.database.data.repositories = [
      ...this.database.data.repositories.filter(
        (repository) => repository.repoId !== input.repoId,
      ),
      {
        repoId: input.repoId,
        sourceVersion,
        indexVersion,
        indexStatus: "pending",
      },
    ];
    this.database.data.files = [
      ...this.database.data.files.filter((file) => file.repoId !== input.repoId),
      ...files.map((file) => ({
        repoId: input.repoId,
        filePath: file.filePath,
      })),
    ];
    this.database.write();

    return {
      sourceVersion,
      indexVersion,
      indexStatus: "pending",
    };
  }

  markIndexReady(repoId: string): SourceRepositoryState {
    return this.updateIndexStatus(repoId, "ready");
  }

  markIndexFailed(repoId: string): SourceRepositoryState {
    return this.updateIndexStatus(repoId, "failed");
  }

  readFileRange(
    repoId: string,
    filePath: string,
    startLine: number,
    endLine: number,
    maxLines: number,
  ): LocalSourceReadRange {
    if (!isSafeRepoRelativePath(filePath)) {
      throw new Error(`Unsafe file path: ${filePath}`);
    }

    const file = this.getFile(repoId, filePath);
    if (!file) {
      throw new Error(`Source file not found: ${filePath}`);
    }

    return sliceLines(file.content, startLine, endLine, maxLines);
  }

  private updateIndexStatus(
    repoId: string,
    indexStatus: SourceRepositoryState["indexStatus"],
  ): SourceRepositoryState {
    const repository = this.findRepository(repoId);
    if (!repository) {
      throw new Error(`Unknown source repository: ${repoId}`);
    }

    repository.indexStatus = indexStatus;
    if (indexStatus === "ready") {
      repository.indexVersion = repository.sourceVersion;
    }
    this.database.write();

    return toSourceState(repository);
  }

  private findRepository(repoId: string): LocalSourceRepositoryRecord | undefined {
    return this.database.data.repositories.find(
      (repository) => repository.repoId === repoId,
    );
  }
}

function toSourceState(record: LocalSourceRepositoryRecord): SourceRepositoryState {
  return {
    sourceVersion: record.sourceVersion,
    indexVersion: record.indexVersion,
    indexStatus: record.indexStatus,
  };
}
