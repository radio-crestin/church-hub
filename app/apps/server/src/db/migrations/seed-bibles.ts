import type { Database } from 'bun:sqlite'
import defaultBibles from '../fixtures/default-bibles.json'

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

/**
 * Seeds default bible translations with books and verses from fixture file.
 * Uses abbreviation uniqueness to avoid duplicates on subsequent runs.
 *
 * To update fixtures:
 * 1. Import bibles in the UI
 * 2. Run: bun run fixtures
 * @throws Error if seeding fails
 */
export function seedBibleTranslations(db: Database): void {
  try {
    // Check if translations already exist in database
    const existingCount = db
      .query<{ count: number }, []>(
        'SELECT COUNT(*) as count FROM bible_translations',
      )
      .get()?.count
    if (existingCount && existingCount > 0) {
      log(
        'info',
        `Bible translations already seeded (${existingCount} translations), skipping`,
      )
      return
    }

    const translations = defaultBibles as BibleTranslationFixture[]

    if (!Array.isArray(translations) || translations.length === 0) {
      log('info', 'No Bible fixtures available, skipping seed')
      return
    }

    log(
      'info',
      `Seeding ${translations.length} Bible translation(s) from fixtures...`,
    )

    // Prepared statements + a single transaction collapse ~62k implicit
    // commits into one. On Windows the row-at-a-time path crawled past
    // 100 s and blew the smoke test budget — same shape of bug seed-
    // songs hit. lastInsertRowid avoids the redundant SELECT after each
    // INSERT.
    const insertTranslation = db.prepare(
      `INSERT INTO bible_translations
        (name, abbreviation, language, source_filename, created_at, updated_at)
        VALUES (?, ?, ?, ?, unixepoch(), unixepoch())`,
    )
    const insertBook = db.prepare(
      `INSERT INTO bible_books
        (translation_id, book_code, book_name, book_order, chapter_count, created_at)
        VALUES (?, ?, ?, ?, ?, unixepoch())`,
    )
    const insertVerse = db.prepare(
      `INSERT INTO bible_verses
        (translation_id, book_id, chapter, verse, text, created_at)
        VALUES (?, ?, ?, ?, ?, unixepoch())`,
    )
    const findTranslationByAbbrev = db.prepare<{ id: number }, [string]>(
      'SELECT id FROM bible_translations WHERE abbreviation = ?',
    )

    let seededCount = 0
    const seedAll = db.transaction(() => {
      for (const translation of translations) {
        if (findTranslationByAbbrev.get(translation.abbreviation)) {
          log(
            'debug',
            `Bible translation already exists: ${translation.abbreviation}, skipping`,
          )
          continue
        }

        const tResult = insertTranslation.run(
          translation.name,
          translation.abbreviation,
          translation.language,
          translation.sourceFilename,
        )
        const translationId = Number(tResult.lastInsertRowid)
        if (!translationId) {
          throw new Error(
            `[seed-bibles] Failed to insert Bible translation '${translation.name}' (${translation.abbreviation}). The bible_translations table may be missing required columns.`,
          )
        }

        let totalVerses = 0
        for (const book of translation.books) {
          const bResult = insertBook.run(
            translationId,
            book.bookCode,
            book.bookName,
            book.bookOrder,
            book.chapterCount,
          )
          const bookId = Number(bResult.lastInsertRowid)
          if (!bookId) {
            throw new Error(
              `[seed-bibles] Failed to insert book '${book.bookName}' for translation '${translation.name}'. The bible_books table may be missing required columns.`,
            )
          }

          for (const verse of book.verses) {
            insertVerse.run(
              translationId,
              bookId,
              verse.chapter,
              verse.verse,
              verse.text,
            )
          }
          totalVerses += book.verses.length
        }

        log(
          'debug',
          `Seeded bible: ${translation.name} (${translation.books.length} books, ${totalVerses} verses)`,
        )
        seededCount++
      }
    })
    seedAll()

    log('info', `Seeded ${seededCount} bible translation(s) from fixtures`)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during seeding'
    throw new Error(
      `[seed-bibles] Failed to seed Bible translations: ${message}. Ensure the 'bible_translations', 'bible_books', and 'bible_verses' tables exist with correct schema.`,
    )
  }
}
