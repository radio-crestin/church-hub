import { nextSortOrder } from './nextSortOrder'
import { parseBookmarksText } from './parseBookmarksText'
import type {
  BibleBookmarkImportError,
  BibleBookmarkImportResult,
} from './types'
import { getDatabase } from '../../db'
import { bibleBookmarkNotes, bibleBookmarks } from '../../db/schema'
import { createLogger } from '../../utils/logger'
import { getBookByCode } from '../bible/books'
import { parseReference } from '../bible/search'
import {
  getDefaultTranslation,
  getTranslationByAbbreviation,
  getTranslationById,
} from '../bible/translations'
import { getVerse } from '../bible/verses'

const logger = createLogger('bible-bookmarks')

/**
 * Turns pasted text into bookmarks, appending them to the existing list.
 *
 * Each line is resolved against the chosen translation so the imported rows
 * carry real verse text - a reference the translation does not contain is
 * reported back per line instead of being silently dropped.
 */
export function importBookmarksFromText(
  text: string,
  translationId?: number,
): BibleBookmarkImportResult {
  const errors: BibleBookmarkImportError[] = []
  let imported = 0
  let notes = 0

  try {
    logger.debug('Importing bible bookmarks from text')

    const entries = parseBookmarksText(text)
    if (entries.length === 0) {
      return { imported: 0, notes: 0, errors: [] }
    }

    const fallbackTranslation =
      (translationId ? getTranslationById(translationId) : null) ??
      getDefaultTranslation()

    const db = getDatabase()
    let sortOrder = nextSortOrder()

    db.transaction((tx) => {
      for (const entry of entries) {
        if (entry.kind === 'note') {
          tx.insert(bibleBookmarkNotes)
            .values({ content: entry.content, sortOrder: sortOrder++ })
            .run()
          notes++
          continue
        }

        const parsed = parseReference(entry.reference)
        if (!parsed) {
          errors.push({
            line: entry.line,
            content: entry.content,
            reason: 'unknown_reference',
          })
          continue
        }

        if (parsed.startVerse === undefined) {
          // Refuse to expand a whole chapter into bookmarks by accident
          errors.push({
            line: entry.line,
            content: entry.content,
            reason: 'verse_required',
          })
          continue
        }

        const translation = entry.translationAbbreviation
          ? (getTranslationByAbbreviation(entry.translationAbbreviation) ??
            fallbackTranslation)
          : fallbackTranslation

        if (!translation) {
          errors.push({
            line: entry.line,
            content: entry.content,
            reason: 'no_translation',
          })
          continue
        }

        const book = getBookByCode(translation.id, parsed.bookCode)
        if (!book) {
          errors.push({
            line: entry.line,
            content: entry.content,
            reason: 'unknown_reference',
          })
          continue
        }

        const endVerse = parsed.endVerse ?? parsed.startVerse
        let addedFromLine = 0

        for (
          let verseNumber = parsed.startVerse;
          verseNumber <= endVerse;
          verseNumber++
        ) {
          const verse = getVerse(
            translation.id,
            parsed.bookCode,
            parsed.chapter,
            verseNumber,
          )
          if (!verse) continue

          tx.insert(bibleBookmarks)
            .values({
              verseId: verse.id,
              reference: `${verse.bookName} ${verse.chapter}:${verse.verse}`,
              text: verse.text,
              translationAbbreviation: translation.abbreviation,
              bookName: verse.bookName,
              bookCode: verse.bookCode,
              translationId: verse.translationId,
              bookId: verse.bookId,
              chapter: verse.chapter,
              verse: verse.verse,
              sortOrder: sortOrder++,
            })
            .run()

          addedFromLine++
          imported++
        }

        if (addedFromLine === 0) {
          errors.push({
            line: entry.line,
            content: entry.content,
            reason: 'verse_not_found',
          })
        }
      }
    })

    logger.info(
      `Imported ${imported} bookmarks and ${notes} notes (${errors.length} lines skipped)`,
    )

    return { imported, notes, errors }
  } catch (error) {
    logger.error(`Failed to import bookmarks: ${error}`)
    return { imported, notes, errors }
  }
}
