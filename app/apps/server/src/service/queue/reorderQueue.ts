import type { OperationResult, ReorderQueueInput } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Reorders queue items based on the new order of IDs
 */
export function reorderQueue(input: ReorderQueueInput): OperationResult {
  try {
    log('debug', `Reordering queue: ${input.itemIds.join(', ')}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    const updateQuery = db.query(`
      UPDATE presentation_queue
      SET sort_order = ?, updated_at = ?
      WHERE id = ?
    `)

    for (let i = 0; i < input.itemIds.length; i++) {
      updateQuery.run(i, now, input.itemIds[i])
    }

    log('info', 'Queue reordered successfully')
    return { success: true }
  } catch (error) {
    log('error', `Failed to reorder queue: ${error}`)
    return { success: false, error: String(error) }
  }
}
