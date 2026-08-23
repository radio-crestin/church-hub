import { nextSortOrder } from './nextSortOrder'
import type { BibleBookmarkNote } from './types'
import { getDatabase } from '../../db'
import { bibleBookmarkNotes } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('bible-bookmarks')

/**
 * Appends a free-text note to the end of the bookmark list
 */
export function addBookmarkNote(
  content: string,
): { data: BibleBookmarkNote } | { error: string } {
  try {
    logger.debug('Adding bible bookmark note')

    const db = getDatabase()
    const inserted = db
      .insert(bibleBookmarkNotes)
      .values({ content, sortOrder: nextSortOrder() })
      .returning()
      .get()

    logger.info(`Bookmark note added: ${inserted.id}`)

    return {
      data: {
        id: inserted.id,
        content: inserted.content,
        sortOrder: inserted.sortOrder,
        createdAt: inserted.createdAt.getTime(),
      },
    }
  } catch (error) {
    logger.error(`Failed to add bookmark note: ${error}`)
    return { error: String(error) }
  }
}
