import { eq, gte, max, sql } from 'drizzle-orm'

import { getQueueItemById } from './getQueue'
import type { InsertBibleVerseInput, QueueItem } from './types'
import { getDatabase } from '../../db'
import { presentationQueue } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Inserts a Bible verse into the presentation queue
 * Can be inserted after a specific item or at the end
 */
export function insertBibleVerseToQueue(
  input: InsertBibleVerseInput,
): QueueItem | null {
  try {
    log(
      'debug',
      `Inserting Bible verse to queue: ${input.reference}${input.afterItemId ? ` after item ${input.afterItemId}` : ''}`,
    )

    const db = getDatabase()

    let targetOrder: number

    if (input.afterItemId) {
      // Get the sort_order of the item we're inserting after
      const afterItem = db
        .select({ sortOrder: presentationQueue.sortOrder })
        .from(presentationQueue)
        .where(eq(presentationQueue.id, input.afterItemId))
        .get()

      if (!afterItem) {
        log('error', `Queue item not found: ${input.afterItemId}`)
        return null
      }

      targetOrder = afterItem.sortOrder + 1

      // Shift all items after the target position
      db.update(presentationQueue)
        .set({
          sortOrder: sql`${presentationQueue.sortOrder} + 1`,
          updatedAt: sql`(unixepoch())` as unknown as Date,
        })
        .where(gte(presentationQueue.sortOrder, targetOrder))
        .run()
    } else {
      // Append to the end
      const maxOrderResult = db
        .select({ maxOrder: max(presentationQueue.sortOrder) })
        .from(presentationQueue)
        .get()
      targetOrder = (maxOrderResult?.maxOrder ?? -1) + 1
    }

    // Insert the Bible verse
    const inserted = db
      .insert(presentationQueue)
      .values({
        itemType: 'bible',
        songId: null,
        slideType: null,
        slideContent: null,
        bibleVerseId: input.verseId,
        bibleReference: input.reference,
        bibleText: input.text,
        bibleTranslation: input.translationAbbreviation,
        sortOrder: targetOrder,
        isExpanded: true,
      })
      .returning({ id: presentationQueue.id })
      .get()

    log(
      'info',
      `Bible verse added to queue: ${inserted.id} (${input.reference})`,
    )

    return getQueueItemById(inserted.id)
  } catch (error) {
    log('error', `Failed to insert Bible verse to queue: ${error}`)
    return null
  }
}
