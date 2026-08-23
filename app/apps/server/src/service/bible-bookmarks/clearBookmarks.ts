import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { bibleBookmarkNotes, bibleBookmarks } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('bible-bookmarks')

/**
 * Empties the bookmark list, notes included
 */
export function clearBookmarks(): OperationResult {
  try {
    logger.debug('Clearing bible bookmarks')

    const db = getDatabase()
    db.delete(bibleBookmarks).run()
    db.delete(bibleBookmarkNotes).run()

    logger.info('Bible bookmarks cleared')
    return { success: true }
  } catch (error) {
    logger.error(`Failed to clear bookmarks: ${error}`)
    return { success: false, error: String(error) }
  }
}
