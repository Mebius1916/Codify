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
    )
  `)
}
