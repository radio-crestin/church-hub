import type {
  CreateTranslationInput,
  ImportResult,
  ParsedBible,
  ParsedBook,
  ParsedChapter,
  ParsedVerse,
} from './types'
import { BOOK_ORDER } from './types'
import { getRawDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [bible:import] ${message}`)
}

/**
 * Parses USFX XML content and extracts Bible structure
 */
export function parseUsfxXml(xmlContent: string): ParsedBible {
  const books: ParsedBook[] = []

  // Extract all book elements
  const bookRegex = /<book\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/book>/gi
  let bookMatch: RegExpExecArray | null

  while ((bookMatch = bookRegex.exec(xmlContent)) !== null) {
    const bookCode = bookMatch[1].toUpperCase()
    const bookContent = bookMatch[2]

    // Extract book name from <h> tag
    const headerMatch = bookContent.match(/<h>([^<]+)<\/h>/)
    const bookName = headerMatch ? headerMatch[1].trim() : bookCode

    // Get book order from mapping
    const bookOrder = BOOK_ORDER[bookCode] || 0

    if (bookOrder === 0) {
      log('warning', `Unknown book code: ${bookCode}, skipping`)
      continue
    }

    const chapters: ParsedChapter[] = []
    let currentChapter = 0
    let currentVerses: ParsedVerse[] = []

    // Process content character by character to handle the USFX structure
    // USFX uses <c id="N"/> for chapter markers and <v id="N"/> for verse markers
    // Text follows the verse marker until the next marker or element

    // Find all chapter and verse markers
    const chapterRegex = /<c\s+id="(\d+)"\s*\/?>/gi
    const verseRegex = /<v\s+id="(\d+)"\s*\/?>/gi

    // Get all chapter positions
    const chapterPositions: { chapter: number; position: number }[] = []
    let chapterMatch: RegExpExecArray | null
    while ((chapterMatch = chapterRegex.exec(bookContent)) !== null) {
      chapterPositions.push({
        chapter: Number.parseInt(chapterMatch[1], 10),
        position: chapterMatch.index,
      })
    }

    // Get all verse positions
    const versePositions: {
      verse: number
      position: number
      endPosition: number
    }[] = []
    let verseMatch: RegExpExecArray | null
    while ((verseMatch = verseRegex.exec(bookContent)) !== null) {
      versePositions.push({
        verse: Number.parseInt(verseMatch[1], 10),
        position: verseMatch.index,
        endPosition: verseMatch.index + verseMatch[0].length,
      })
    }

    // Process verses by extracting text between verse markers
    for (let i = 0; i < versePositions.length; i++) {
      const verseInfo = versePositions[i]

      // Find which chapter this verse belongs to
      let verseChapter = 1
      for (const cp of chapterPositions) {
        if (cp.position < verseInfo.position) {
          verseChapter = cp.chapter
        } else {
          break
        }
      }

      // If chapter changed, save previous chapter and start new one
      if (verseChapter !== currentChapter) {
        if (currentChapter > 0 && currentVerses.length > 0) {
          chapters.push({
            chapter: currentChapter,
            verses: currentVerses,
          })
        }
        currentChapter = verseChapter
        currentVerses = []
      }

      // Extract verse text (from end of verse tag to next verse or chapter tag, or end of content)
      let endPosition = bookContent.length
      if (i + 1 < versePositions.length) {
        endPosition = versePositions[i + 1].position
      }

      // Also check if there's a chapter marker before the next verse
      for (const cp of chapterPositions) {
        if (cp.position > verseInfo.endPosition && cp.position < endPosition) {
          endPosition = cp.position
          break
        }
      }

      let verseText = bookContent.substring(verseInfo.endPosition, endPosition)

      // Clean up the verse text
      verseText = cleanVerseText(verseText)

      if (verseText.trim()) {
        currentVerses.push({
          verse: verseInfo.verse,
          text: verseText.trim(),
        })
      }
    }

    // Save last chapter
    if (currentChapter > 0 && currentVerses.length > 0) {
      chapters.push({
        chapter: currentChapter,
        verses: currentVerses,
      })
    }

    if (chapters.length > 0) {
      books.push({
        bookCode,
        bookName,
        bookOrder,
        chapters,
      })
    }
  }

  // Sort books by order
  books.sort((a, b) => a.bookOrder - b.bookOrder)

  return { books }
}

/**
 * Cleans verse text by removing XML tags and normalizing whitespace
 */
function cleanVerseText(text: string): string {
  // Remove XML tags but preserve text content
  let cleaned = text
    // Remove self-closing tags
    .replace(/<[^>]+\/>/g, '')
    // Remove opening tags
    .replace(/<[^/][^>]*>/g, '')
    // Remove closing tags
    .replace(/<\/[^>]+>/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Trim
    .trim()

  // Decode common HTML entities
  cleaned = cleaned
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')

  return cleaned
}

/**
 * Imports a USFX Bible translation into the database
 */
export function importUsfxTranslation(
  input: CreateTranslationInput,
): ImportResult {
  const db = getRawDatabase()
  const now = Math.floor(Date.now() / 1000)

  try {
    log(
      'info',
      `Importing Bible translation: ${input.name} (${input.abbreviation})`,
    )

    // Parse the XML content
    const parsed = parseUsfxXml(input.xmlContent)

    if (parsed.books.length === 0) {
      return {
        success: false,
        error: 'No books found in the XML content',
      }
    }

    log('info', `Parsed ${parsed.books.length} books`)

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
        // Calculate chapter count
        const chapterCount = book.chapters.length

        // Insert book
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
        const versesToInsert: Array<
          [number, number, number, number, string, number]
        > = []

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

      log(
        'info',
        `Successfully imported ${parsed.books.length} books with ${totalVerses} verses`,
      )

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
      error:
        error instanceof Error ? error.message : 'Unknown error during import',
    }
  }
}
