import { getMigrations } from 'better-auth/db/migration'
import { auth, authDatabase } from './auth.ts'

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
  authDatabase.exec(`
    CREATE TABLE IF NOT EXISTS user_workspace_settings (
      user_id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}
