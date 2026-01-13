import { eq } from 'drizzle-orm'

import type { SearchHistoryItem } from './types'
import { getDatabase } from '../../db'
import { songSearchHistory } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [search-history] ${message}`)
}

/**
 * Gets a search history entry by ID
 */
export function getSearchById(
  id: number,
): { data: SearchHistoryItem | null } | { error: string } {
  try {
    log('debug', `Getting search history by ID: ${id}`)

    const db = getDatabase()

    const result = db
      .select()
      .from(songSearchHistory)
      .where(eq(songSearchHistory.id, id))
      .get()

    if (!result) {
      log('debug', `No search history found for ID: ${id}`)
      return { data: null }
    }

    log('debug', `Found search history: ${result.id}`)

    return {
      data: {
        id: result.id,
        query: result.query,
        urlPath: result.urlPath,
        searchType: result.searchType as 'regular' | 'ai',
        categoryIds: result.categoryIds ? JSON.parse(result.categoryIds) : null,
        aiResults: result.aiResults ? JSON.parse(result.aiResults) : null,
        resultCount: result.resultCount,
        createdAt: result.createdAt.getTime(),
      },
    }
  } catch (error) {
    log('error', `Failed to get search history: ${error}`)
    return { error: String(error) }
  }
}
