import { Injectable } from '@nestjs/common'
import { authDatabase } from '../auth/auth.ts'
import type { WorkspaceSettingsDto } from './dto/workspaceSettingsDto.ts'

interface WorkspaceSettingsRow {
  settings_json: string
}

@Injectable()
export class WorkspaceSettingsService {
  getSettings(userId: string): Partial<WorkspaceSettingsDto> | null {
    const row = authDatabase
      .prepare('SELECT settings_json FROM user_workspace_settings WHERE user_id = ?')
      .get(userId) as WorkspaceSettingsRow | undefined

    if (!row) return null

    try {
      return JSON.parse(row.settings_json) as Partial<WorkspaceSettingsDto>
    } catch {
      return null
    }
  }

  saveSettings(userId: string, settings: WorkspaceSettingsDto): WorkspaceSettingsDto {
    const settingsJson = JSON.stringify(settings)
    authDatabase
      .prepare(`
        INSERT INTO user_workspace_settings (user_id, settings_json, created_at, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET
          settings_json = excluded.settings_json,
          updated_at = CURRENT_TIMESTAMP
      `)
      .run(userId, settingsJson)

    return settings
  }
}
