import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-highlight-colors:${level}] ${message}`)
}

interface HighlightColorFixture {
  name: string
  color: string
  sortOrder: number
}

const FIXTURE_PATH = join(
  import.meta.dir,
  '../fixtures/default-highlight-colors.json',
)

/**
 * Seeds default highlight colors from fixture file.
 * Uses INSERT OR IGNORE to avoid duplicates on subsequent runs.
 */
export function seedHighlightColors(db: Database): void {
  log('debug', 'Checking if highlight colors fixture exists...')

  if (!existsSync(FIXTURE_PATH)) {
    log('debug', 'No highlight colors fixture found, skipping seed')
    return
  }

  const colors = require(FIXTURE_PATH) as HighlightColorFixture[]

  if (!Array.isArray(colors) || colors.length === 0) {
    log('debug', 'Highlight colors fixture is empty, skipping seed')
    return
  }

  log('info', 'Seeding highlight colors from fixtures...')

  for (const color of colors) {
    db.run(
      `INSERT OR IGNORE INTO highlight_colors
        (name, color, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, unixepoch(), unixepoch())`,
      [color.name, color.color, color.sortOrder],
    )
    log('debug', `Seeded highlight color: ${color.name} (${color.color})`)
  }

  log('info', `Seeded ${colors.length} highlight color(s) from fixtures`)
}
