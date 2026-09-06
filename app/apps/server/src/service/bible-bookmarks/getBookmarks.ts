import { asc } from 'drizzle-orm'

import { toBookmark } from './toBookmark'
import type { BibleBookmark } from './types'
import { getDatabase } from '../../db'
import { bibleBookmarks } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('bible-bookmarks')

/**
 * Gets all bookmarked verses, in the user's chosen order
 */
export function getBookmarks(): BibleBookmark[] {
  try {
    logger.debug('Getting bible bookmarks')

    const db = getDatabase()
    const records = db
      .select()
      .from(bibleBookmarks)
      .orderBy(asc(bibleBookmarks.sortOrder))
      .all()

    logger.debug(`Found ${records.length} bookmarks`)

    return records.map(toBookmark)
  } catch (error) {
    logger.error(`Failed to get bookmarks: ${error}`)
    return []
  }
}
