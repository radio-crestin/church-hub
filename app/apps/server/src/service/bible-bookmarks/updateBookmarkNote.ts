import { eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { bibleBookmarkNotes } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('bible-bookmarks')

/**
 * Rewrites the text of an existing note
 */
export function updateBookmarkNote(
  noteId: number,
  content: string,
): OperationResult {
  try {
    logger.debug(`Updating bible bookmark note ${noteId}`)

    const db = getDatabase()
    db.update(bibleBookmarkNotes)
      .set({ content })
      .where(eq(bibleBookmarkNotes.id, noteId))
      .run()

    logger.info(`Bookmark note updated: ${noteId}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to update bookmark note: ${error}`)
    return { success: false, error: String(error) }
  }
}
