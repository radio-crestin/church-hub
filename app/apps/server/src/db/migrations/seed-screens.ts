import type { Database } from 'bun:sqlite'
import defaultScreens from '../fixtures/default-screens.json'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-screens:${level}] ${message}`)
}

interface ScreenFixture {
  name: string
  type: 'primary' | 'stage' | 'livestream'
  isActive: boolean
  openMode: string
  isFullscreen: boolean
  width: number
  height: number
  globalSettings: Record<string, unknown>
  sortOrder: number
  contentConfigs: Record<string, Record<string, unknown>>
  nextSlideConfig?: Record<string, unknown>
}

/**
 * Seeds default screens with their configurations from fixture file.
 * Uses count check to avoid duplicates on subsequent runs.
 *
 * To update fixtures:
 * 1. Configure screens in the UI
 * 2. Run: bun run apps/server/src/db/fixtures/dump-screens.ts
 * @throws Error if seeding fails
 */
export function seedDefaultScreens(db: Database): void {
  log('debug', 'Checking if screens need to be seeded...')

  try {
    // Check if any screens already exist
    const existingCount = db
      .query('SELECT COUNT(*) as count FROM screens')
      .get() as { count: number }

    if (existingCount.count > 0) {
      log(
        'debug',
        `Screens already exist (${existingCount.count}), skipping seed`,
      )
      return
    }

    log('info', 'Seeding default screens from fixtures...')

    const screens = defaultScreens as ScreenFixture[]

    for (const screen of screens) {
      // Insert screen
      db.run(
        `INSERT INTO screens
          (name, type, is_active, open_mode, is_fullscreen, width, height, global_settings, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
        [
          screen.name,
          screen.type,
          screen.isActive ? 1 : 0,
          screen.openMode,
          screen.isFullscreen ? 1 : 0,
          screen.width,
          screen.height,
          JSON.stringify(screen.globalSettings),
          screen.sortOrder,
        ],
      )

      // Get the inserted screen ID
      const inserted = db
        .query('SELECT id FROM screens WHERE name = ?')
        .get(screen.name) as { id: number } | null

      if (!inserted) {
        throw new Error(
          `[seed-screens] Failed to insert screen '${screen.name}'. The screens table may be missing required columns.`,
        )
      }

      // Create content configs for all content types
      for (const [contentType, config] of Object.entries(
        screen.contentConfigs,
      )) {
        db.run(
          `INSERT INTO screen_content_configs
            (screen_id, content_type, config, created_at, updated_at)
            VALUES (?, ?, ?, unixepoch(), unixepoch())`,
          [inserted.id, contentType, JSON.stringify(config)],
        )
      }

      // Create next slide config for stage screens
      if (screen.nextSlideConfig) {
        db.run(
          `INSERT INTO screen_next_slide_configs
            (screen_id, config, created_at, updated_at)
            VALUES (?, ?, unixepoch(), unixepoch())`,
          [inserted.id, JSON.stringify(screen.nextSlideConfig)],
        )
      }

      log('debug', `Seeded screen: ${screen.name} (${screen.type})`)
    }

    log('info', `Seeded ${screens.length} default screens from fixtures`)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during seeding'
    throw new Error(
      `[seed-screens] Failed to seed default screens: ${message}. Ensure the 'screens', 'screen_content_configs', and 'screen_next_slide_configs' tables exist with correct schema.`,
    )
  }
}
