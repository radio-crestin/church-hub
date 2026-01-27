import type { Database } from 'bun:sqlite'
import defaultSettings from '../fixtures/default-settings.json'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-settings:${level}] ${message}`)
}

interface AppSettingFixture {
  key: string
  value: string
}

/**
 * Seeds default app settings from fixture file.
 * Uses INSERT OR IGNORE to preserve user-modified settings.
 *
 * Settings include:
 * - sidebar_configuration: Sidebar menu layout
 * - search_synonyms: Search term synonyms
 * - theme: UI theme preference
 * - language: Language preference
 * - default_bible_translation: Default Bible translation ID
 * - selected_bible_translations: Configured Bible translations
 *
 * To update fixtures:
 * 1. Configure settings in the UI
 * 2. Run: bun run fixtures
 * @throws Error if seeding fails
 */
export function seedAppSettings(db: Database): void {
  const settings = defaultSettings as AppSettingFixture[]

  if (!Array.isArray(settings) || settings.length === 0) {
    log('info', 'No settings fixtures available, skipping seed')
    return
  }

  log('info', `Seeding ${settings.length} app setting(s) from fixtures...`)

  try {
    let seededCount = 0

    for (const setting of settings) {
      // Check if setting already exists (preserve user modifications)
      const existing = db
        .query('SELECT id FROM app_settings WHERE key = ?')
        .get(setting.key) as { id: number } | null

      if (existing) {
        log('debug', `Setting already exists: ${setting.key}, skipping`)
        continue
      }

      db.run(
        `INSERT INTO app_settings
          (key, value, created_at, updated_at)
          VALUES (?, ?, unixepoch(), unixepoch())`,
        [setting.key, setting.value],
      )

      log('debug', `Seeded setting: ${setting.key}`)
      seededCount++
    }

    log('info', `Seeded ${seededCount} app setting(s) from fixtures`)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during seeding'
    throw new Error(
      `[seed-settings] Failed to seed app settings: ${message}. Ensure the 'app_settings' table exists with columns: key, value, created_at, updated_at.`,
    )
  }
}
