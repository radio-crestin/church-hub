import { existsSync } from 'node:fs'
import { join } from 'node:path'

import type { Database } from 'bun:sqlite'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: seed logging
  console.log(`[seed-bibles:${level}] ${message}`)
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

const FIXTURE_PATH = join(import.meta.dir, '../fixtures/default-bibles.json')

/**
 * Seeds default bible translations with books and verses from fixture file.
 * Uses abbreviation uniqueness to avoid duplicates on subsequent runs.
 *
 * To update fixtures:
 * 1. Import bibles in the UI
 * 2. Run: bun run fixtures
 */
export function seedBibleTranslations(db: Database): void {
  // Check if translations already exist in database BEFORE loading large fixture file
  const existingCount = db
    .query<{ count: number }, []>(
      'SELECT COUNT(*) as count FROM bible_translations',
    )
    .get()?.count
  if (existingCount && existingCount > 0) {
    log(
      'info',
      `Bible translations already seeded (${existingCount} translations), skipping fixture load`,
    )
    return
  }

  log('debug', 'Checking if bibles fixture exists...')

  if (!existsSync(FIXTURE_PATH)) {
    log('debug', 'No bibles fixture found, skipping seed')
    return
  }

  const translations = require(FIXTURE_PATH) as BibleTranslationFixture[]

  if (!Array.isArray(translations) || translations.length === 0) {
    log('debug', 'Bibles fixture is empty, skipping seed')
    return
  }

  log('info', 'Seeding bible translations from fixtures...')

  let seededCount = 0

  for (const translation of translations) {
    // Check if translation already exists
    const existing = db
      .query('SELECT id FROM bible_translations WHERE abbreviation = ?')
      .get(translation.abbreviation) as { id: number } | null

    if (existing) {
      log(
        'debug',
        `Bible translation already exists: ${translation.abbreviation}, skipping`,
      )
      continue
    }

    // Insert translation
    db.run(
      `INSERT INTO bible_translations
        (name, abbreviation, language, source_filename, created_at, updated_at)
        VALUES (?, ?, ?, ?, unixepoch(), unixepoch())`,
      [
        translation.name,
        translation.abbreviation,
        translation.language,
        translation.sourceFilename,
      ],
    )

    // Get the inserted translation ID
    const inserted = db
      .query('SELECT id FROM bible_translations WHERE abbreviation = ?')
      .get(translation.abbreviation) as { id: number } | null

    if (!inserted) {
      log(
        'warning',
        `Failed to get inserted translation ID for ${translation.name}`,
      )
      continue
    }

    const translationId = inserted.id
    let totalVerses = 0

    // Insert books and verses
    for (const book of translation.books) {
      db.run(
        `INSERT INTO bible_books
          (translation_id, book_code, book_name, book_order, chapter_count, created_at)
          VALUES (?, ?, ?, ?, ?, unixepoch())`,
        [
          translationId,
          book.bookCode,
          book.bookName,
          book.bookOrder,
          book.chapterCount,
        ],
      )

      // Get the inserted book ID
      const insertedBook = db
        .query(
          'SELECT id FROM bible_books WHERE translation_id = ? AND book_code = ?',
        )
        .get(translationId, book.bookCode) as { id: number } | null

      if (!insertedBook) {
        log('warning', `Failed to get inserted book ID for ${book.bookName}`)
        continue
      }

      const bookId = insertedBook.id

      // Insert verses in batches for better performance
      if (book.verses.length > 0) {
        const stmt = db.prepare(
          `INSERT INTO bible_verses
            (translation_id, book_id, chapter, verse, text, created_at)
            VALUES (?, ?, ?, ?, ?, unixepoch())`,
        )

        for (const verse of book.verses) {
          stmt.run(
            translationId,
            bookId,
            verse.chapter,
            verse.verse,
            verse.text,
          )
        }

        totalVerses += book.verses.length
      }
    }

    log(
      'debug',
      `Seeded bible: ${translation.name} (${translation.books.length} books, ${totalVerses} verses)`,
    )
    seededCount++
  }

  log('info', `Seeded ${seededCount} bible translation(s) from fixtures`)
}
