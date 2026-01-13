import { eq, sql } from 'drizzle-orm'

import type { SaveSearchInput, SearchHistoryItem } from './types'
import { getDatabase } from '../../db'
import { songSearchHistory } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [search-history] ${message}`)
}

/**
 * Saves a search to history, updating timestamp if same query/type exists
 */
export function saveSearch(
  input: SaveSearchInput,
): { data: SearchHistoryItem } | { error: string } {
  try {
    if (!input.query.trim()) {
      return { error: 'Query cannot be empty' }
    }

    log(
      'debug',
      `Saving search to history: "${input.query}" (${input.searchType})`,
    )

    const db = getDatabase()

    // Check if this exact search already exists (same query, type, and url path)
    const existing = db
      .select()
      .from(songSearchHistory)
      .where(eq(songSearchHistory.urlPath, input.urlPath))
      .get()

    if (existing) {
      // Update the existing entry with new data
      const updated = db
        .update(songSearchHistory)
        .set({
          query: input.query.trim(),
          searchType: input.searchType,
          categoryIds: input.categoryIds
            ? JSON.stringify(input.categoryIds)
            : null,
          aiResults: input.aiResults ? JSON.stringify(input.aiResults) : null,
          resultCount: input.resultCount ?? null,
          createdAt: sql`(unixepoch())`,
        })
        .where(eq(songSearchHistory.id, existing.id))
        .returning()
        .get()

      log('info', `Search history updated: ${updated.id}`)

      return {
        data: {
          id: updated.id,
          query: updated.query,
          urlPath: updated.urlPath,
          searchType: updated.searchType as 'regular' | 'ai',
          categoryIds: updated.categoryIds
            ? JSON.parse(updated.categoryIds)
            : null,
          aiResults: updated.aiResults ? JSON.parse(updated.aiResults) : null,
          resultCount: updated.resultCount,
          createdAt: updated.createdAt.getTime(),
        },
      }
    }

    // Insert new entry
    const inserted = db
      .insert(songSearchHistory)
      .values({
        query: input.query.trim(),
        urlPath: input.urlPath,
        searchType: input.searchType,
        categoryIds: input.categoryIds
          ? JSON.stringify(input.categoryIds)
          : null,
        aiResults: input.aiResults ? JSON.stringify(input.aiResults) : null,
        resultCount: input.resultCount ?? null,
      })
      .returning()
      .get()

    log('info', `Search saved to history: ${inserted.id}`)

    return {
      data: {
        id: inserted.id,
        query: inserted.query,
        urlPath: inserted.urlPath,
        searchType: inserted.searchType as 'regular' | 'ai',
        categoryIds: inserted.categoryIds
          ? JSON.parse(inserted.categoryIds)
          : null,
        aiResults: inserted.aiResults ? JSON.parse(inserted.aiResults) : null,
        resultCount: inserted.resultCount,
        createdAt: inserted.createdAt.getTime(),
      },
    }
  } catch (error) {
    log('error', `Failed to save search to history: ${error}`)
    return { error: String(error) }
  }
}
