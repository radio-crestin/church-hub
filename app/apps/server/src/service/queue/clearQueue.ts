import type { OperationResult } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Clears all items from the presentation queue
 */
export function clearQueue(): OperationResult {
  try {
    log('debug', 'Clearing queue')

    const db = getDatabase()
    db.query('DELETE FROM presentation_queue').run()

    log('info', 'Queue cleared')
    return { success: true }
  } catch (error) {
    log('error', `Failed to clear queue: ${error}`)
    return { success: false, error: String(error) }
  }
}
