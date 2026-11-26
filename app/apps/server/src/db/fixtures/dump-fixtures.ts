/**
 * Script to dump database configurations to fixture files.
 * Run with: bun run fixtures
 *
 * Dumps:
 * - Screens (with their own template's design)
 * - Songs (with slides)
 * - Song categories
 * - Bible translations (metadata only)
 * - App settings (sidebar config, search synonyms, appearance, etc.)
 */

import { join } from 'node:path'

import { sanitizeSettingValue } from './sanitize-setting-value'
import { writeFixture } from './write-fixture'
import Database from 'bun:sqlite'
import { getDatabasePath } from '../../utils/paths'

// Use the same database path as the dev server
const DB_PATH = getDatabasePath()
const FIXTURES_DIR = join(import.meta.dir)

// ============================================================================
// Types
// ============================================================================

interface ScreenRow {
  id: number
  name: string
  type: 'primary' | 'stage' | 'livestream' | 'kiosk'
  is_active: number
  open_mode: string
  is_fullscreen: number
  sort_order: number
  width: number
  height: number
  layouts: string
  global_settings: string
  next_slide: string
}

interface ScreenFixture {
  name: string
  type: 'primary' | 'stage' | 'livestream' | 'kiosk'
  isActive: boolean
  openMode: string
  isFullscreen: boolean
  sortOrder: number
  /** The screen's own template (seed-screens makes it a template again). */
  design: {
    width: number
    height: number
    layouts: Record<string, Record<string, unknown>>
    globalSettings: Record<string, unknown>
    nextSlide: Record<string, unknown>
  }
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
  tempo: string | null
  time_signature: string | null
  theme: string | null
  alt_theme: string | null
  hymn_number: string | null
  key_line: string | null
  presentation_order: string | null
  presentation_count: number
  last_presented_at: number | null
  last_manual_edit: number | null
}

interface SongFixture {
  title: string
  categoryName: string | null
  sourceFilename: string | null
  author: string | null
  copyright: string | null
  ccli: string | null
  tempo: string | null
  timeSignature: string | null
  theme: string | null
  altTheme: string | null
  hymnNumber: string | null
  keyLine: string | null
  presentationOrder: string | null
  presentationCount: number
  lastPresentedAt: number | null
  lastManualEdit: number | null
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

interface BibleBookRow {
  id: number
  translation_id: number
  book_code: string
  book_name: string
  book_order: number
  chapter_count: number
}

interface BibleVerseFixture {
  chapter: number
  verse: number
  text: string
}

interface BibleBookFixture {
  bookCode: string
  bookName: string
  bookOrder: number
  chapterCount: number
  verses: BibleVerseFixture[]
}

interface BibleTranslationFixture {
  name: string
  abbreviation: string
  language: string
  sourceFilename: string | null
  books: BibleBookFixture[]
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
    .query(
      `SELECT s.*, t.width, t.height, t.layouts, t.global_settings, t.next_slide
       FROM screens s JOIN slide_templates t ON t.id = s.template_id
       ORDER BY s.sort_order`,
    )
    .all() as ScreenRow[]

  if (screens.length === 0) {
    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log('No screens found in database.')
    return
  }

  const fixtures: ScreenFixture[] = screens.map((screen) => ({
    name: screen.name,
    type: screen.type,
    isActive: screen.is_active === 1,
    openMode: screen.open_mode,
    isFullscreen: screen.is_fullscreen === 1,
    sortOrder: screen.sort_order,
    design: {
      width: screen.width,
      height: screen.height,
      layouts: JSON.parse(screen.layouts),
      globalSettings: JSON.parse(screen.global_settings),
      nextSlide: JSON.parse(screen.next_slide),
    },
  }))

  const outputPath = join(FIXTURES_DIR, 'default-screens.json')
  writeFixture(outputPath, fixtures)

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
  writeFixture(outputPath, fixtures)

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
      tempo: song.tempo,
      timeSignature: song.time_signature,
      theme: song.theme,
      altTheme: song.alt_theme,
      hymnNumber: song.hymn_number,
      keyLine: song.key_line,
      presentationOrder: song.presentation_order,
      presentationCount: song.presentation_count,
      lastPresentedAt: song.last_presented_at,
      lastManualEdit: song.last_manual_edit,
      slides: slides.map((s) => ({
        content: s.content,
        label: s.label,
        sortOrder: s.sort_order,
      })),
    }

    fixtures.push(fixture)
  }

  const outputPath = join(FIXTURES_DIR, 'default-songs.json')
  writeFixture(outputPath, fixtures)

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

  const fixtures: BibleTranslationFixture[] = []

  for (const translation of translations) {
    // Get all books for this translation
    const books = db
      .query(
        'SELECT * FROM bible_books WHERE translation_id = ? ORDER BY book_order',
      )
      .all(translation.id) as BibleBookRow[]

    const bookFixtures: BibleBookFixture[] = []

    for (const book of books) {
      // Get all verses for this book
      const verses = db
        .query(
          'SELECT chapter, verse, text FROM bible_verses WHERE book_id = ? ORDER BY chapter, verse',
        )
        .all(book.id) as BibleVerseFixture[]

      bookFixtures.push({
        bookCode: book.book_code,
        bookName: book.book_name,
        bookOrder: book.book_order,
        chapterCount: book.chapter_count,
        verses,
      })
    }

    fixtures.push({
      name: translation.name,
      abbreviation: translation.abbreviation,
      language: translation.language,
      sourceFilename: translation.source_filename,
      books: bookFixtures,
    })

    // biome-ignore lint/suspicious/noConsole: CLI script output
    console.log(
      `  - ${translation.name}: ${books.length} books, ${bookFixtures.reduce((sum, b) => sum + b.verses.length, 0)} verses`,
    )
  }

  const outputPath = join(FIXTURES_DIR, 'default-bibles.json')
  writeFixture(outputPath, fixtures)

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

  const fixtures: AppSettingFixture[] = settings.flatMap((s) => {
    const value = sanitizeSettingValue(s.key, s.value)
    return value === null ? [] : [{ key: s.key, value }]
  })

  const outputPath = join(FIXTURES_DIR, 'default-settings.json')
  writeFixture(outputPath, fixtures)

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
