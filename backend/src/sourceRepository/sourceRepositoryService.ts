import { Injectable } from '@nestjs/common'
import {
  LocalSourceRepository,
  type LocalSourceFileInput,
} from '@codify/converters'
import { appDatabase } from '../database/appDatabase.ts'
import { LoggingService } from '../logging/loggingService.ts'

const DEFAULT_SOURCE_REPOSITORY_ID = 'default'
const DEFAULT_SOURCE_REPOSITORY_LOCAL_ROOT = new URL(
  '../../data/source-repository',
  import.meta.url,
).pathname

export interface ReplaceSourceRepositoryFilesInput {
  files: LocalSourceFileInput[]
}

export interface SyncedSourceRepository {
  repoRoot: string
  fileCount: number
}

interface SourceRepositoryFileRow {
  file_path: string
  content: string
}

@Injectable()
export class SourceRepositoryService {
  private readonly localRepository = LocalSourceRepository.inRepo(
    DEFAULT_SOURCE_REPOSITORY_LOCAL_ROOT,
  )

  constructor(private readonly loggingService: LoggingService) {}

  replaceFiles(input: ReplaceSourceRepositoryFilesInput): void {
    appDatabase.exec('BEGIN')
    try {
      appDatabase.prepare('DELETE FROM source_repository_files').run()

      const insertFile = appDatabase.prepare(`
        INSERT INTO source_repository_files (
          file_path,
          content,
          created_at,
          updated_at
        ) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)

      for (const file of input.files) {
        insertFile.run(file.filePath, file.content)
      }

      appDatabase.exec('COMMIT')

      this.loggingService.info('Source repository files replaced', {
        module: 'sourceRepository',
        source: 'backend',
        fileCount: input.files.length,
      })
    } catch (error) {
      appDatabase.exec('ROLLBACK')
      throw error
    }
  }

  syncLocalSource(): SyncedSourceRepository | undefined {
    const files = this.getDatabaseFiles()
    if (files.length === 0) {
      this.loggingService.warn('Source repository has no database files to sync', {
        module: 'sourceRepository',
        source: 'backend',
      })
      return undefined
    }

    this.localRepository.overwriteFiles({
      repoId: DEFAULT_SOURCE_REPOSITORY_ID,
      files,
    })

    const syncedSource = {
      repoRoot: this.localRepository.getLocalRepoRoot(DEFAULT_SOURCE_REPOSITORY_ID),
      fileCount: files.length,
    }

    this.loggingService.info('Source repository synced to local files', {
      module: 'sourceRepository',
      source: 'backend',
      ...syncedSource,
    })

    return syncedSource
  }

  private getDatabaseFiles(): LocalSourceFileInput[] {
    const rows = appDatabase
      .prepare(`
        SELECT file_path, content
        FROM source_repository_files
        ORDER BY file_path
      `)
      .all() as unknown as SourceRepositoryFileRow[]

    return rows.map((row) => ({
      filePath: row.file_path,
      content: row.content,
    }))
  }
}
