import { getMigrations } from 'better-auth/db/migration'
import { auth } from './auth.ts'

export async function runAuthMigrations() {
  const migrations = await getMigrations(auth.options)
  if (migrations.toBeCreated.length === 0 && migrations.toBeAdded.length === 0) {
    return
  }

  await migrations.runMigrations()
}
