import { getMigrations } from 'better-auth/db/migration'
import { appDatabase } from '../database/appDatabase.ts'
import { auth } from './auth.ts'

export async function runAuthMigrations() {
  const migrations = await getMigrations(auth.options)
  if (migrations.toBeCreated.length === 0 && migrations.toBeAdded.length === 0) {
    runAppAuthMigrations()
    return
  }

  await migrations.runMigrations()
  runAppAuthMigrations()
}

function runAppAuthMigrations() {
  appDatabase.exec(`
    CREATE TABLE IF NOT EXISTS user_workspace_settings (
      user_id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS source_insight_runs (
      id TEXT PRIMARY KEY,
      ai_enhance_run_id TEXT NOT NULL,
      figma_file_key TEXT NOT NULL,
      figma_node_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'done', 'failed', 'skipped')),
      prompt TEXT NOT NULL,
      answer TEXT,
      evidence_json TEXT,
      tool_trace_json TEXT,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS source_repository_files (
      file_path TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (file_path)
    );
  `)

  migrateInstrumentationPacketsTable()
}

// instrumentation_packets 改为每策略一行；旧版整包 blob 表结构不含 strategy_id 时重建（派生缓存可再生）。
function migrateInstrumentationPacketsTable() {
  const columns = appDatabase
    .prepare(`PRAGMA table_info(instrumentation_packets)`)
    .all() as Array<{ name: string }>

  const isLegacySchema =
    columns.length > 0 && !columns.some((column) => column.name === 'strategy_id')
  if (isLegacySchema) {
    appDatabase.exec(`DROP TABLE instrumentation_packets`)
  }

  appDatabase.exec(`
    CREATE TABLE IF NOT EXISTS instrumentation_packets (
      figma_file_key TEXT NOT NULL,
      figma_node_id TEXT NOT NULL,
      strategy_id TEXT NOT NULL,
      packet_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (figma_file_key, figma_node_id, strategy_id)
    )
  `)
}
