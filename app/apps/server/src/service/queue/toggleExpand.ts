import { getQueueItemById } from './getQueue'
import type { QueueItem } from './types'
import { getDatabase } from '../../db'

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
    const now = Math.floor(Date.now() / 1000)

    // Toggle is_expanded (1 -> 0, 0 -> 1)
    const updateQuery = db.query(`
      UPDATE presentation_queue
      SET is_expanded = CASE WHEN is_expanded = 1 THEN 0 ELSE 1 END,
          updated_at = ?
      WHERE id = ?
    `)
    updateQuery.run(now, id)

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
    const now = Math.floor(Date.now() / 1000)

    const updateQuery = db.query(`
      UPDATE presentation_queue
      SET is_expanded = ?, updated_at = ?
      WHERE id = ?
    `)
    updateQuery.run(expanded ? 1 : 0, now, id)

    log('info', `Queue item expand set: ${id} = ${expanded}`)
    return getQueueItemById(id)
  } catch (error) {
    log('error', `Failed to set expand: ${error}`)
    return null
  }
}
