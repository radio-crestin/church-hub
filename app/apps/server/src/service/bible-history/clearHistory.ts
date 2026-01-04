import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { bibleHistory } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [bible-history] ${message}`)
}

/**
 * Clears all items from the Bible history
 * Called on graceful application shutdown
 */
export function clearHistory(): OperationResult {
  try {
    log('debug', 'Clearing Bible history')

    const db = getDatabase()
    db.delete(bibleHistory).run()

    log('info', 'Bible history cleared')
    return { success: true }
  } catch (error) {
    log('error', `Failed to clear history: ${error}`)
    return { success: false, error: String(error) }
  }
}
