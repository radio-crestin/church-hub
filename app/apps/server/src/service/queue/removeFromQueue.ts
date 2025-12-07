import type { OperationResult } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Removes a queue item by ID
 */
export function removeFromQueue(id: number): OperationResult {
  try {
    log('debug', `Removing queue item: ${id}`)

    const db = getDatabase()
    const query = db.query('DELETE FROM presentation_queue WHERE id = ?')
    query.run(id)

    log('info', `Queue item removed: ${id}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to remove from queue: ${error}`)
    return { success: false, error: String(error) }
  }
}
