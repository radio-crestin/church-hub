import { eq } from 'drizzle-orm'

import { nextSortOrder } from './nextSortOrder'
import { toBookmark } from './toBookmark'
import type { BibleBookmark } from './types'
import { getDatabase } from '../../db'
import { bibleBookmarks, bibleTranslations } from '../../db/schema'
import { createLogger } from '../../utils/logger'
import { getVerseById } from '../bible/verses'

const logger = createLogger('bible-bookmarks')

/**
 * Bookmarks a verse.
 *
 * The verse is looked up and denormalized here so callers only need the id,
 * and so an imported reference and a UI click produce identical rows.
 * A verse may be bookmarked more than once - duplicates are intentional.
 */
export function addBookmark(
  verseId: number,
): { data: BibleBookmark } | { error: string } {
  try {
    logger.debug(`Adding bookmark for verse ${verseId}`)

    const verse = getVerseById(verseId)
    if (!verse) {
      return { error: 'Verse not found' }
    }

    const db = getDatabase()

    const translation = db
      .select({ abbreviation: bibleTranslations.abbreviation })
      .from(bibleTranslations)
      .where(eq(bibleTranslations.id, verse.translationId))
      .get()

    const inserted = db
      .insert(bibleBookmarks)
      .values({
        verseId: verse.id,
        reference: `${verse.bookName} ${verse.chapter}:${verse.verse}`,
        text: verse.text,
        translationAbbreviation: translation?.abbreviation ?? '',
        bookName: verse.bookName,
        bookCode: verse.bookCode,
        translationId: verse.translationId,
        bookId: verse.bookId,
        chapter: verse.chapter,
        verse: verse.verse,
        sortOrder: nextSortOrder(),
      })
      .returning()
      .get()

    logger.info(`Bookmark added: ${inserted.id} (${inserted.reference})`)

    return { data: toBookmark(inserted) }
  } catch (error) {
    logger.error(`Failed to add bookmark: ${error}`)
    return { error: String(error) }
  }
}
