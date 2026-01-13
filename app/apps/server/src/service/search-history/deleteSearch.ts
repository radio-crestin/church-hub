import { eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { songSearchHistory } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [search-history] ${message}`)
}

/**
 * Deletes a search history entry by URL path
 */
export function deleteSearch(urlPath: string): OperationResult {
  try {
    log('debug', `Deleting search history for URL: ${urlPath}`)

    const db = getDatabase()

    db.delete(songSearchHistory)
      .where(eq(songSearchHistory.urlPath, urlPath))
      .run()

    log('info', `Search history deleted for URL: ${urlPath}`)

    return { success: true }
  } catch (error) {
    log('error', `Failed to delete search history: ${error}`)
    return { success: false, error: String(error) }
  }
}
