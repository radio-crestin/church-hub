import { eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { bibleBookmarkNotes } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('bible-bookmarks')

/**
 * Deletes a note from the bookmark list
 */
export function removeBookmarkNote(noteId: number): OperationResult {
  try {
    logger.debug(`Removing bible bookmark note ${noteId}`)

    const db = getDatabase()
    db.delete(bibleBookmarkNotes).where(eq(bibleBookmarkNotes.id, noteId)).run()

    logger.info(`Bookmark note removed: ${noteId}`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to remove bookmark note: ${error}`)
    return { success: false, error: String(error) }
  }
}
