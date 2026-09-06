import { eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { bibleBookmarks } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('bible-bookmarks')

/**
 * Removes a single bookmark row by its own id (not the verse id), so that
 * duplicate bookmarks of the same verse can be removed independently
 */
export function removeBookmark(bookmarkId: number): OperationResult {
  try {
    logger.debug(`Removing bookmark ${bookmarkId}`)

    const db = getDatabase()
    db.delete(bibleBookmarks).where(eq(bibleBookmarks.id, bookmarkId)).run()

    logger.info(`Bookmark removed: ${bookmarkId}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to remove bookmark: ${error}`)
    return { success: false, error: String(error) }
  }
}
