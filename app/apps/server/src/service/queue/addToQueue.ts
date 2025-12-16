import { eq, gte, max, sql } from 'drizzle-orm'

import { getQueueItemById } from './getQueue'
import type { AddToQueueInput, QueueItem } from './types'
import { getDatabase } from '../../db'
import { presentationQueue } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Adds a song to the presentation queue
 * Can be inserted after a specific item or at the end
 */
export function addToQueue(input: AddToQueueInput): QueueItem | null {
  try {
    log(
      'debug',
      `Adding song to queue: ${input.songId}${input.afterItemId ? ` after item ${input.afterItemId}` : ''}`,
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
      // Get the max sort_order to append at the end
      const maxOrderResult = db
        .select({ maxOrder: max(presentationQueue.sortOrder) })
        .from(presentationQueue)
        .get()
      targetOrder = (maxOrderResult?.maxOrder ?? -1) + 1
    }

    // Insert the queue item
    const inserted = db
      .insert(presentationQueue)
      .values({
        itemType: 'song',
        songId: input.songId,
        sortOrder: targetOrder,
        isExpanded: true,
      })
      .returning({ id: presentationQueue.id })
      .get()

    log('info', `Song added to queue: ${inserted.id}`)

    return getQueueItemById(inserted.id)
  } catch (error) {
    log('error', `Failed to add to queue: ${error}`)
    return null
  }
}
