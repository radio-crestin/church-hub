import { eq } from 'drizzle-orm'

import { nextSortOrder } from './nextSortOrder'
import { toBookmark } from './toBookmark'
import type { BibleBookmark, BibleBookmarkStyleRange } from './types'
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
 *
 * `styleRanges` carries the highlights and underlines drawn on the verse while
 * it was on screen. They are character offsets into the verse text, so the
 * caller must only pass ranges that were actually drawn on THIS verse - the
 * live slide keeps one global set that would otherwise bleed across verses.
 * Ranges landing wholly outside the text are dropped rather than stored.
 */
export function addBookmark(
  verseId: number,
  styleRanges?: BibleBookmarkStyleRange[],
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
        styleRanges: serializeStyleRanges(styleRanges, verse.text),
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

/**
 * Keeps only the ranges that actually cover part of this verse, and clamps
 * them to its length, so a stale offset from a longer verse cannot survive.
 * Returns null when nothing is left, which reads back as "no styling".
 */
function serializeStyleRanges(
  ranges: BibleBookmarkStyleRange[] | undefined,
  text: string,
): string | null {
  if (!ranges || ranges.length === 0) return null

  const usable = ranges
    .map((range) => ({
      ...range,
      start: Math.max(0, Math.min(range.start, text.length)),
      end: Math.max(0, Math.min(range.end, text.length)),
    }))
    .filter((range) => range.start < range.end)

  return usable.length > 0 ? JSON.stringify(usable) : null
}
