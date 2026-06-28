import 'dotenv/config'

import { mkdirSync } from 'node:fs'
import { readFile, readdir, stat } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { env } from '../src/config/env.ts'

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../..',
)
const sourceRoot = 'design2code'
const maxSourceFileBytes = 512 * 1024

const excludedPathParts = new Set([
  '.git',
  'dist',
  'node_modules',
])

const excludedFileNames = new Set([
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
])

const includedExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.jsx',
  '.md',
  '.ts',
  '.tsx',
])

type SourceFile = {
  filePath: string
  content: string
}

async function main() {
  const files = await collectSourceFiles()
  mkdirSync(dirname(env.auth.databasePath), { recursive: true })
  const database = new DatabaseSync(env.auth.databasePath)

  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS source_repository_files (
        file_path TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (file_path)
      )
    `)

    database.exec('BEGIN')
    try {
      database.prepare('DELETE FROM source_repository_files').run()
      const insertFile = database.prepare(`
        INSERT INTO source_repository_files (
          file_path,
          content,
          created_at,
          updated_at
        ) VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `)

      for (const file of files) {
        insertFile.run(file.filePath, file.content)
      }

      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
  } finally {
    database.close()
  }

  console.log(`Synced ${files.length} source files into source_repository_files`)
}

async function collectSourceFiles(): Promise<SourceFile[]> {
  const files: SourceFile[] = []
  await walkPath(resolve(repoRoot, sourceRoot), files)
  return files.sort((left, right) => left.filePath.localeCompare(right.filePath))
}

async function walkPath(absolutePath: string, files: SourceFile[]): Promise<void> {
  const relativePath = relative(repoRoot, absolutePath).split('\\').join('/')
  if (!relativePath || shouldSkipPath(relativePath)) return

  const entryStat = await stat(absolutePath).catch(() => undefined)
  if (!entryStat) return

  if (entryStat.isDirectory()) {
    const entries = await readdir(absolutePath, { withFileTypes: true })
    for (const entry of entries) {
      await walkPath(resolve(absolutePath, entry.name), files)
    }
    return
  }

  if (!entryStat.isFile()) return
  if (entryStat.size > maxSourceFileBytes) return
  if (!includedExtensions.has(extname(relativePath))) return

  const content = await readFile(absolutePath, 'utf8').catch(() => undefined)
  if (content === undefined || content.includes('\0')) return

  files.push({
    filePath: relativePath,
    content,
  })
}

function shouldSkipPath(filePath: string): boolean {
  const parts = filePath.split('/')
  if (parts.some((part) => excludedPathParts.has(part))) return true
  if (excludedFileNames.has(parts[parts.length - 1] ?? '')) return true

  return false
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
