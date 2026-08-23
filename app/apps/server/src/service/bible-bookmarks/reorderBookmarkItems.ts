import { eq } from 'drizzle-orm'

import type { BibleBookmarkItemRef, OperationResult } from './types'
import { getDatabase } from '../../db'
import { bibleBookmarkNotes, bibleBookmarks } from '../../db/schema'
import { createLogger } from '../../utils/logger'

const logger = createLogger('bible-bookmarks')

/**
 * Rewrites the shared ordering sequence for the whole merged list.
 *
 * Callers must send every row, not just the moved ones, because verses and
 * notes share one sequence and a partial write would interleave them wrongly.
 */
export function reorderBookmarkItems(
  items: BibleBookmarkItemRef[],
): OperationResult {
  try {
    logger.debug(`Reordering ${items.length} bible bookmark items`)

    const db = getDatabase()

    db.transaction((tx) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type === 'verse') {
          tx.update(bibleBookmarks)
            .set({ sortOrder: i })
            .where(eq(bibleBookmarks.id, item.id))
            .run()
        } else {
          tx.update(bibleBookmarkNotes)
            .set({ sortOrder: i })
            .where(eq(bibleBookmarkNotes.id, item.id))
            .run()
        }
      }
    })

    logger.info(`Reordered ${items.length} bible bookmark items`)
    return { success: true }
  } catch (error) {
    logger.error(`Failed to reorder bookmark items: ${error}`)
    return { success: false, error: String(error) }
  }
}
