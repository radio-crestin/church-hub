import { getQueueItemById } from './getQueue'
import type { QueueItem, UpdateSlideInput } from './types'
import { getDatabase } from '../../db'

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
    const now = Math.floor(Date.now() / 1000)

    // Verify the item exists and is a slide type
    const existingItem = db
      .query('SELECT id, item_type FROM presentation_queue WHERE id = ?')
      .get(input.id) as { id: number; item_type: string } | null

    if (!existingItem) {
      log('error', `Queue item not found: ${input.id}`)
      return null
    }

    if (existingItem.item_type !== 'slide') {
      log('error', `Queue item is not a slide: ${input.id}`)
      return null
    }

    // Update the slide
    db.query(`
      UPDATE presentation_queue
      SET slide_type = ?, slide_content = ?, updated_at = ?
      WHERE id = ?
    `).run(input.slideType, input.slideContent, now, input.id)

    log('info', `Slide updated in queue: ${input.id}`)

    return getQueueItemById(input.id)
  } catch (error) {
    log('error', `Failed to update slide in queue: ${error}`)
    return null
  }
}
