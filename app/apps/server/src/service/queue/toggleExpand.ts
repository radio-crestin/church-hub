import { eq, sql } from 'drizzle-orm'

import { getQueueItemById } from './getQueue'
import type { QueueItem } from './types'
import { getDatabase } from '../../db'
import { presentationQueue } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Toggles the expanded state of a queue item
 */
export function toggleExpand(id: number): QueueItem | null {
  try {
    log('debug', `Toggling expand for queue item: ${id}`)

    const db = getDatabase()

    // Toggle is_expanded (true -> false, false -> true)
    db.update(presentationQueue)
      .set({
        isExpanded: sql`CASE WHEN ${presentationQueue.isExpanded} = 1 THEN 0 ELSE 1 END`,
        updatedAt: sql`(unixepoch())` as unknown as Date,
      })
      .where(eq(presentationQueue.id, id))
      .run()

    log('info', `Queue item expand toggled: ${id}`)
    return getQueueItemById(id)
  } catch (error) {
    log('error', `Failed to toggle expand: ${error}`)
    return null
  }
}

/**
 * Sets the expanded state of a queue item
 */
export function setExpanded(id: number, expanded: boolean): QueueItem | null {
  try {
    log('debug', `Setting expand for queue item: ${id} to ${expanded}`)

    const db = getDatabase()

    db.update(presentationQueue)
      .set({
        isExpanded: expanded,
        updatedAt: sql`(unixepoch())` as unknown as Date,
      })
      .where(eq(presentationQueue.id, id))
      .run()

    log('info', `Queue item expand set: ${id} = ${expanded}`)
    return getQueueItemById(id)
  } catch (error) {
    log('error', `Failed to set expand: ${error}`)
    return null
  }
}
