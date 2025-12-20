/**
 * Script to dump database configurations to fixture files.
 * Run with: bun run fixtures
 *
 * Dumps:
 * - Screens (with content configs and next slide configs)
 * - Songs (with slides)
 * - Song categories
 * - Bible translations (metadata only)
 * - App settings (sidebar config, search synonyms, appearance, etc.)
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import Database from 'bun:sqlite'

// Resolve path relative to this file's location
const DB_PATH = join(import.meta.dir, '..', '..', '..', 'data', 'app.db')
const FIXTURES_DIR = join(import.meta.dir)

// ============================================================================
// Types
// ============================================================================

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

interface SongCategoryRow {
  id: number
  name: string
  priority: number
}

interface SongCategoryFixture {
  name: string
  priority: number
}

interface SongRow {
  id: number
  title: string
  category_id: number | null
  source_filename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  key: string | null
  tempo: string | null
  time_signature: string | null
  theme: string | null
  alt_theme: string | null
  hymn_number: string | null
  key_line: string | null
  presentation_order: string | null
  presentation_count: number
}

interface SongFixture {
  title: string
  categoryName: string | null
  sourceFilename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  key: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  presentationCount: number
  slides: Array<{
    content: string
    label: string | null
    sortOrder: number
  }>
}

interface BibleTranslationRow {
  id: number
  name: string
  abbreviation: string
  language: string
  source_filename: string | null
}

interface BibleTranslationFixture {
  name: string
  abbreviation: string
  language: string
  sourceFilename: string | null
}

interface AppSettingRow {
  id: number
  key: string
  value: string
}

interface AppSettingFixture {
  key: string
  value: string
}

// ============================================================================
// Dump Functions
// ============================================================================

function dumpScreens(db: Database): void {
  const screens = db
    .query('SELECT * FROM screens ORDER BY sort_order')
    .all() as ScreenRow[]

  if (screens.length === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log('No screens found in database.')
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

  const outputPath = join(FIXTURES_DIR, 'default-screens.json')
  writeFileSync(outputPath, JSON.stringify(fixtures, null, 2))

  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.log(`✓ Dumped ${fixtures.length} screen(s) to default-screens.json`)
}

function dumpSongCategories(db: Database): void {
  const categories = db
    .query('SELECT * FROM song_categories ORDER BY priority, name')
    .all() as SongCategoryRow[]

  if (categories.length === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log('No song categories found in database.')
    return
  }

  const fixtures: SongCategoryFixture[] = categories.map((cat) => ({
    name: cat.name,
    priority: cat.priority,
  }))

  const outputPath = join(FIXTURES_DIR, 'default-song-categories.json')
  writeFileSync(outputPath, JSON.stringify(fixtures, null, 2))

  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.log(
    `✓ Dumped ${fixtures.length} song category(ies) to default-song-categories.json`,
  )
}

function dumpSongs(db: Database): void {
  // Get category mapping for looking up names
  const categories = db
    .query('SELECT id, name FROM song_categories')
    .all() as Array<{ id: number; name: string }>

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]))

  const songs = db
    .query('SELECT * FROM songs ORDER BY title')
    .all() as SongRow[]

  if (songs.length === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log('No songs found in database.')
    return
  }

  const fixtures: SongFixture[] = []

  for (const song of songs) {
    const slides = db
      .query(
        'SELECT content, label, sort_order FROM song_slides WHERE song_id = ? ORDER BY sort_order',
      )
      .all(song.id) as Array<{
      content: string
      label: string | null
      sort_order: number
    }>

    const fixture: SongFixture = {
      title: song.title,
      categoryName: song.category_id
        ? (categoryMap.get(song.category_id) ?? null)
        : null,
      sourceFilename: song.source_filename,
      author: song.author,
      copyright: song.copyright,
      ccli: song.ccli,
      key: song.key,
      tempo: song.tempo,
      timeSignature: song.time_signature,
      theme: song.theme,
      altTheme: song.alt_theme,
      hymnNumber: song.hymn_number,
      keyLine: song.key_line,
      presentationOrder: song.presentation_order,
      presentationCount: song.presentation_count,
      slides: slides.map((s) => ({
        content: s.content,
        label: s.label,
        sortOrder: s.sort_order,
      })),
    }

    fixtures.push(fixture)
  }

  const outputPath = join(FIXTURES_DIR, 'default-songs.json')
  writeFileSync(outputPath, JSON.stringify(fixtures, null, 2))

  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.log(`✓ Dumped ${fixtures.length} song(s) to default-songs.json`)
}

function dumpBibleTranslations(db: Database): void {
  const translations = db
    .query('SELECT * FROM bible_translations ORDER BY name')
    .all() as BibleTranslationRow[]

  if (translations.length === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log('No bible translations found in database.')
    return
  }

  const fixtures: BibleTranslationFixture[] = translations.map((t) => ({
    name: t.name,
    abbreviation: t.abbreviation,
    language: t.language,
    sourceFilename: t.source_filename,
  }))

  const outputPath = join(FIXTURES_DIR, 'default-bibles.json')
  writeFileSync(outputPath, JSON.stringify(fixtures, null, 2))

  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.log(
    `✓ Dumped ${fixtures.length} bible translation(s) to default-bibles.json`,
  )
}

function dumpAppSettings(db: Database): void {
  const settings = db
    .query('SELECT key, value FROM app_settings ORDER BY key')
    .all() as AppSettingRow[]

  if (settings.length === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log('No app settings found in database.')
    return
  }

  const fixtures: AppSettingFixture[] = settings.map((s) => ({
    key: s.key,
    value: s.value,
  }))

  const outputPath = join(FIXTURES_DIR, 'default-settings.json')
  writeFileSync(outputPath, JSON.stringify(fixtures, null, 2))

  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.log(
    `✓ Dumped ${fixtures.length} app setting(s) to default-settings.json`,
  )
}

// ============================================================================
// Main
// ============================================================================

function main(): void {
  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.log('Dumping database fixtures...\n')
  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.log(`Database path: ${DB_PATH}`)
  // biome-ignore lint/suspicious/noConsole: CLI script output
  console.log(`Output directory: ${FIXTURES_DIR}\n`)

  const db = new Database(DB_PATH)

  try {
    dumpScreens(db)
    dumpSongCategories(db)
    dumpSongs(db)
    dumpBibleTranslations(db)
    dumpAppSettings(db)

    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log('\n✓ All fixtures dumped successfully!')
  } finally {
    db.close()
  }
}

main()
