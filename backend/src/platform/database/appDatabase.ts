import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { env } from '../config/env.ts'

mkdirSync(dirname(env.auth.databasePath), { recursive: true })

export const appDatabase = new DatabaseSync(env.auth.databasePath)

