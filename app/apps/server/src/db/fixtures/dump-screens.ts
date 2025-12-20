/**
 * Script to dump screen configurations from the database to fixture files.
 * Run with: bun run apps/server/src/db/fixtures/dump-screens.ts
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import Database from 'bun:sqlite'

const DB_PATH = './data/app.db'
const FIXTURES_DIR = join(import.meta.dir)

interface ScreenRow {
  id: number
  name: string
  type: 'primary' | 'stage' | 'livestream'
  is_active: number
  open_mode: string
  is_fullscreen: number
  width: number
  height: number
  global_settings: string
  sort_order: number
}

interface ContentConfigRow {
  screen_id: number
  content_type: string
  config: string
}

interface NextSlideConfigRow {
  screen_id: number
  config: string
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

function dumpScreens(): void {
  const db = new Database(DB_PATH, { readonly: true })

  const screens = db
    .query('SELECT * FROM screens ORDER BY sort_order')
    .all() as ScreenRow[]

  if (screens.length === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log(
      'No screens found in database. Create screens first, then run this script.',
    )
    db.close()
    return
  }

  const fixtures: ScreenFixture[] = []

  for (const screen of screens) {
    // Get content configs
    const contentConfigs = db
      .query(
        'SELECT content_type, config FROM screen_content_configs WHERE screen_id = ?',
      )
      .all(screen.id) as ContentConfigRow[]

    const contentConfigsMap: Record<string, Record<string, unknown>> = {}
    for (const cc of contentConfigs) {
      contentConfigsMap[cc.content_type] = JSON.parse(cc.config)
    }

    // Get next slide config (for stage screens)
    const nextSlideConfig = db
      .query('SELECT config FROM screen_next_slide_configs WHERE screen_id = ?')
      .get(screen.id) as NextSlideConfigRow | null

    const fixture: ScreenFixture = {
      name: screen.name,
      type: screen.type,
      isActive: screen.is_active === 1,
      openMode: screen.open_mode,
      isFullscreen: screen.is_fullscreen === 1,
      width: screen.width,
      height: screen.height,
      globalSettings: JSON.parse(screen.global_settings),
      sortOrder: screen.sort_order,
      contentConfigs: contentConfigsMap,
    }

    if (nextSlideConfig) {
      fixture.nextSlideConfig = JSON.parse(nextSlideConfig.config)
    }

    fixtures.push(fixture)
  }

  db.close()

  // Write to fixture file
  const outputPath = join(FIXTURES_DIR, 'default-screens.json')
  writeFileSync(outputPath, JSON.stringify(fixtures, null, 2))

  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.log(`Dumped ${fixtures.length} screen(s) to ${outputPath}`)
}

dumpScreens()
