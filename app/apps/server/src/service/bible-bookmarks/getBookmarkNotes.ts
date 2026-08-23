import { asc } from 'drizzle-orm'

import type { BibleBookmarkNote } from './types'
import { getDatabase } from '../../db'
import { bibleBookmarkNotes } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('bible-bookmarks')

/**
 * Gets all bookmark notes, in the user's chosen order
 */
export function getBookmarkNotes(): BibleBookmarkNote[] {
  try {
    logger.debug('Getting bible bookmark notes')

    const db = getDatabase()
    const records = db
      .select()
      .from(bibleBookmarkNotes)
      .orderBy(asc(bibleBookmarkNotes.sortOrder))
      .all()

    return records.map((record) => ({
      id: record.id,
      content: record.content,
      sortOrder: record.sortOrder,
      createdAt: record.createdAt.getTime(),
    }))
  } catch (error) {
    logger.error(`Failed to get bookmark notes: ${error}`)
    return []
  }
}
