import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-song-categories:${level}] ${message}`)
}

interface SongCategoryFixture {
  name: string
  priority: number
}

const FIXTURE_PATH = join(
  import.meta.dir,
  '../fixtures/default-song-categories.json',
)

/**
 * Seeds default song categories from fixture file.
 * Uses INSERT OR IGNORE to avoid duplicates on subsequent runs.
 *
 * To update fixtures:
 * 1. Configure song categories in the UI
 * 2. Run: bun run fixtures
 */
export function seedSongCategories(db: Database): void {
  log('debug', 'Checking if song categories fixture exists...')

  if (!existsSync(FIXTURE_PATH)) {
    log('debug', 'No song categories fixture found, skipping seed')
    return
  }

  // Dynamic import to handle missing file gracefully
  const categories = require(FIXTURE_PATH) as SongCategoryFixture[]

  if (!Array.isArray(categories) || categories.length === 0) {
    log('debug', 'Song categories fixture is empty, skipping seed')
    return
  }

  log('info', 'Seeding song categories from fixtures...')

  for (const category of categories) {
    db.run(
      `INSERT OR IGNORE INTO song_categories
        (name, priority, created_at, updated_at)
        VALUES (?, ?, unixepoch(), unixepoch())`,
      [category.name, category.priority],
    )
    log('debug', `Seeded song category: ${category.name}`)
  }

  log('info', `Seeded ${categories.length} song category(ies) from fixtures`)
}
