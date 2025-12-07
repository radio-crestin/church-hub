import { getQueueItemById } from './getQueue'
import type { AddToQueueInput, QueueItem } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Adds a song to the presentation queue
 */
export function addToQueue(input: AddToQueueInput): QueueItem | null {
  try {
    log('debug', `Adding song to queue: ${input.songId}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    // Get the max sort_order to append at the end
    const maxOrderResult = db
      .query('SELECT MAX(sort_order) as max_order FROM presentation_queue')
      .get() as { max_order: number | null }
    const nextOrder = (maxOrderResult?.max_order ?? -1) + 1

    // Insert the queue item
    const insertQuery = db.query(`
      INSERT INTO presentation_queue (item_type, song_id, sort_order, is_expanded, created_at, updated_at)
      VALUES ('song', ?, ?, 1, ?, ?)
    `)
    insertQuery.run(input.songId, nextOrder, now, now)

    // Get the inserted ID
    const getLastId = db.query('SELECT last_insert_rowid() as id')
    const result = getLastId.get() as { id: number }
    const queueItemId = result.id

    log('info', `Song added to queue: ${queueItemId}`)

    return getQueueItemById(queueItemId)
  } catch (error) {
    log('error', `Failed to add to queue: ${error}`)
    return null
  }
}
