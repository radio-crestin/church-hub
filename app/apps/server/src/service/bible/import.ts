import type {
  CreateTranslationInput,
  ImportResult,
  ParsedBible,
} from './types'
import { importUsfxTranslation, parseUsfxXml } from './import-usfx'
import { parseOsisXml } from './import-osis'
import { parseZefaniaXml } from './import-zefania'
import { getRawDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [bible:import] ${message}`)
}

/**
 * Detects the XML format of the Bible content
 * Returns: 'usfx' | 'osis' | 'zefania' | 'unknown'
 */
export function detectBibleFormat(xmlContent: string): 'usfx' | 'osis' | 'zefania' | 'unknown' {
  // Check first 2000 characters for root element detection
  const sample = xmlContent.substring(0, 2000).toLowerCase()

  // USFX: <usfx> root element
  if (sample.includes('<usfx')) {
    return 'usfx'
  }

  // Zefania: <XMLBIBLE> root element (case-insensitive check)
  if (sample.includes('<xmlbible')) {
    return 'zefania'
  }

  // OSIS: <osis> or <osistext> elements
  if (sample.includes('<osis') || sample.includes('osisidwork') || sample.includes('osisrefwork')) {
    return 'osis'
  }

  return 'unknown'
}

/**
 * Parses Bible XML content using the appropriate parser based on format detection
 */
export function parseBibleXml(xmlContent: string): { format: string; parsed: ParsedBible } | { error: string } {
  const format = detectBibleFormat(xmlContent)

  log('info', `Detected Bible format: ${format}`)

  switch (format) {
    case 'usfx':
      return { format: 'USFX', parsed: parseUsfxXml(xmlContent) }
    case 'osis':
      return { format: 'OSIS', parsed: parseOsisXml(xmlContent) }
    case 'zefania':
      return { format: 'Zefania', parsed: parseZefaniaXml(xmlContent) }
    default:
      return { error: 'Unable to detect Bible format. Supported formats: USFX, OSIS, Zefania XML' }
  }
}

/**
 * Imports a Bible translation into the database with auto-format detection
 * Supports USFX, OSIS, and Zefania XML formats
 */
export function importBibleTranslation(input: CreateTranslationInput): ImportResult {
  const db = getRawDatabase()
  const now = Math.floor(Date.now() / 1000)

  try {
    log('info', `Importing Bible translation: ${input.name} (${input.abbreviation})`)

    // Detect and parse the XML content
    const parseResult = parseBibleXml(input.xmlContent)

    if ('error' in parseResult) {
      return {
        success: false,
        error: parseResult.error,
      }
    }

    const { format, parsed } = parseResult

    if (parsed.books.length === 0) {
      return {
        success: false,
        error: `No books found in the ${format} XML content`,
      }
    }

    log('info', `Parsed ${parsed.books.length} books from ${format} format`)

    // Start transaction
    db.exec('BEGIN TRANSACTION')

    try {
      // Check if translation already exists
      const existing = db
        .query('SELECT id FROM bible_translations WHERE abbreviation = ?')
        .get(input.abbreviation) as { id: number } | null

      if (existing) {
        db.exec('ROLLBACK')
        return {
          success: false,
          error: `Translation with abbreviation "${input.abbreviation}" already exists`,
        }
      }

      // Insert translation
      const translationResult = db.run(
        `INSERT INTO bible_translations (name, abbreviation, language, source_filename, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [input.name, input.abbreviation, input.language, null, now, now],
      )

      const translationId = Number(translationResult.lastInsertRowid)

      let totalVerses = 0

      // Insert books and verses
      for (const book of parsed.books) {
        const chapterCount = book.chapters.length

        const bookResult = db.run(
          `INSERT INTO bible_books (translation_id, book_code, book_name, book_order, chapter_count, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            translationId,
            book.bookCode,
            book.bookName,
            book.bookOrder,
            chapterCount,
            now,
          ],
        )

        const bookId = Number(bookResult.lastInsertRowid)

        // Insert verses in batches for performance
        const BATCH_SIZE = 500
        const versesToInsert: Array<[number, number, number, number, string, number]> = []

        for (const chapter of book.chapters) {
          for (const verse of chapter.verses) {
            versesToInsert.push([
              translationId,
              bookId,
              chapter.chapter,
              verse.verse,
              verse.text,
              now,
            ])
            totalVerses++
          }
        }

        // Batch insert verses
        for (let i = 0; i < versesToInsert.length; i += BATCH_SIZE) {
          const batch = versesToInsert.slice(i, i + BATCH_SIZE)
          const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
          const values = batch.flat()

          db.run(
            `INSERT INTO bible_verses (translation_id, book_id, chapter, verse, text, created_at)
             VALUES ${placeholders}`,
            values,
          )
        }
      }

      // Update FTS index
      log('info', 'Updating full-text search index...')
      db.exec(`
        INSERT INTO bible_verses_fts (rowid, text)
        SELECT id, text FROM bible_verses WHERE translation_id = ${translationId}
      `)

      // Commit transaction
      db.exec('COMMIT')

      log('info', `Successfully imported ${parsed.books.length} books with ${totalVerses} verses (${format} format)`)

      // Get the translation with counts
      const translation = db
        .query(`
          SELECT
            t.*,
            (SELECT COUNT(*) FROM bible_books WHERE translation_id = t.id) as book_count,
            (SELECT COUNT(*) FROM bible_verses WHERE translation_id = t.id) as verse_count
          FROM bible_translations t
          WHERE t.id = ?
        `)
        .get(translationId) as {
        id: number
        name: string
        abbreviation: string
        language: string
        source_filename: string | null
        created_at: number
        updated_at: number
        book_count: number
        verse_count: number
      }

      return {
        success: true,
        translation: {
          id: translation.id,
          name: translation.name,
          abbreviation: translation.abbreviation,
          language: translation.language,
          sourceFilename: translation.source_filename,
          bookCount: translation.book_count,
          verseCount: translation.verse_count,
          createdAt: translation.created_at,
          updatedAt: translation.updated_at,
        },
        booksImported: parsed.books.length,
        versesImported: totalVerses,
      }
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  } catch (error) {
    log('error', `Failed to import translation: ${error}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during import',
    }
  }
}
