import { eq, sql } from 'drizzle-orm'

import { getQueueItemById } from './getQueue'
import type { QueueItem, UpdateSlideInput } from './types'
import { getDatabase } from '../../db'
import { presentationQueue } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Updates a standalone slide in the presentation queue
 */
export function updateSlide(input: UpdateSlideInput): QueueItem | null {
  try {
    log('debug', `Updating slide in queue: ${input.id}`)

    const db = getDatabase()

    // Verify the item exists and is a slide type
    const existingItem = db
      .select({
        id: presentationQueue.id,
        itemType: presentationQueue.itemType,
      })
      .from(presentationQueue)
      .where(eq(presentationQueue.id, input.id))
      .get()

    if (!existingItem) {
      log('error', `Queue item not found: ${input.id}`)
      return null
    }

    if (existingItem.itemType !== 'slide') {
      log('error', `Queue item is not a slide: ${input.id}`)
      return null
    }

    // Update the slide
    db.update(presentationQueue)
      .set({
        slideType: input.slideType,
        slideContent: input.slideContent,
        updatedAt: sql`(unixepoch())` as unknown as Date,
      })
      .where(eq(presentationQueue.id, input.id))
      .run()

    log('info', `Slide updated in queue: ${input.id}`)

    return getQueueItemById(input.id)
  } catch (error) {
    log('error', `Failed to update slide in queue: ${error}`)
    return null
  }
}
