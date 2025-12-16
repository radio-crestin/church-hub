import { and, asc, eq } from 'drizzle-orm'

import type { ScheduleSearchResult } from './types'
import { getDatabase, getRawDatabase } from '../../db'
import { scheduleItems, schedules, songs } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedule-search] ${message}`)
}

/**
 * Updates the FTS index for a specific schedule
 * Indexes schedule title, description, and all song content
 * Uses Drizzle for non-FTS queries, raw SQL for FTS operations
 */
export function updateScheduleSearchIndex(scheduleId: number): void {
  try {
    log('debug', `Updating search index for schedule: ${scheduleId}`)

    const db = getDatabase()
    const rawDb = getRawDatabase()

    // Get schedule metadata
    const schedule = db
      .select({ title: schedules.title, description: schedules.description })
      .from(schedules)
      .where(eq(schedules.id, scheduleId))
      .get()

    if (!schedule) {
      log('debug', `Schedule not found for indexing: ${scheduleId}`)
      return
    }

    // Get all song titles in this schedule
    const songTitles = db
      .select({ title: songs.title })
      .from(scheduleItems)
      .innerJoin(songs, eq(scheduleItems.songId, songs.id))
      .where(
        and(
          eq(scheduleItems.scheduleId, scheduleId),
          eq(scheduleItems.itemType, 'song'),
        ),
      )
      .orderBy(asc(scheduleItems.sortOrder))
      .all()
    const combinedTitles = songTitles.map((s) => s.title).join(' ')

    // Get all song content in this schedule (use raw SQL for complex join)
    const songContentResults = rawDb
      .query(`
      SELECT ss.content
      FROM schedule_items si
      JOIN song_slides ss ON si.song_id = ss.song_id
      WHERE si.schedule_id = ? AND si.item_type = 'song'
      ORDER BY si.sort_order ASC, ss.sort_order ASC
    `)
      .all(scheduleId) as { content: string }[]
    const combinedContent = songContentResults.map((s) => s.content).join(' ')

    // Remove existing index entry (FTS operation - use raw DB)
    rawDb.run('DELETE FROM schedules_fts WHERE schedule_id = ?', scheduleId)

    // Insert new index entry (FTS operation - use raw DB)
    rawDb.run(
      `INSERT INTO schedules_fts (schedule_id, title, description, song_titles, song_content)
       VALUES (?, ?, ?, ?, ?)`,
      scheduleId,
      schedule.title,
      schedule.description ?? '',
      combinedTitles,
      combinedContent,
    )

    log('debug', `Search index updated for schedule: ${scheduleId}`)
  } catch (error) {
    log('error', `Failed to update search index: ${error}`)
  }
}

/**
 * Removes a schedule from the FTS index
 * Uses raw SQL for FTS operations
 */
export function removeFromScheduleSearchIndex(scheduleId: number): void {
  try {
    log('debug', `Removing schedule from search index: ${scheduleId}`)

    const rawDb = getRawDatabase()
    rawDb.run('DELETE FROM schedules_fts WHERE schedule_id = ?', scheduleId)

    log('debug', `Schedule removed from search index: ${scheduleId}`)
  } catch (error) {
    log('error', `Failed to remove from search index: ${error}`)
  }
}

/**
 * Rebuilds the entire schedule search index
 * Uses Drizzle for schedule list, raw SQL for FTS operations
 */
export function rebuildScheduleSearchIndex(): void {
  try {
    log('info', 'Rebuilding schedule search index...')

    const db = getDatabase()
    const rawDb = getRawDatabase()

    // Clear existing index (FTS operation - use raw DB)
    rawDb.exec('DELETE FROM schedules_fts')

    // Get all schedules
    const allSchedules = db.select({ id: schedules.id }).from(schedules).all()

    for (const schedule of allSchedules) {
      updateScheduleSearchIndex(schedule.id)
    }

    log(
      'info',
      `Schedule search index rebuilt: ${allSchedules.length} schedules indexed`,
    )
  } catch (error) {
    log('error', `Failed to rebuild search index: ${error}`)
  }
}

/**
 * Searches schedules using FTS5
 * Searches in title, description, song titles, and song content
 * Uses raw SQL for FTS5 MATCH queries (not supported by Drizzle)
 */
export function searchSchedules(query: string): ScheduleSearchResult[] {
  try {
    log('debug', `Searching schedules: ${query}`)

    if (!query.trim()) {
      return []
    }

    const rawDb = getRawDatabase()

    // Escape special FTS5 characters and add prefix matching
    const escapedQuery = query
      .replace(/['"]/g, '')
      .replace(/[*()^:+\-\\]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => `"${term}"*`)
      .join(' OR ')

    if (!escapedQuery) {
      return []
    }

    // Use FTS5 MATCH query with snippet for highlighting
    // Note: snippet() doesn't work with GROUP BY, so we use a subquery for item_count
    const results = rawDb
      .query(`
      SELECT
        s.id,
        s.title,
        s.description,
        (SELECT COUNT(*) FROM schedule_items si WHERE si.schedule_id = s.id) as item_count,
        snippet(schedules_fts, 1, '<mark>', '</mark>', '...', 30) as matched_content
      FROM schedules_fts
      JOIN schedules s ON schedules_fts.schedule_id = s.id
      WHERE schedules_fts MATCH ?
      ORDER BY rank
      LIMIT 50
    `)
      .all(escapedQuery) as Array<{
      id: number
      title: string
      description: string | null
      item_count: number
      matched_content: string
    }>

    log('debug', `Search found ${results.length} results`)

    return results.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      itemCount: r.item_count,
      matchedContent: r.matched_content,
    }))
  } catch (error) {
    log('error', `Failed to search schedules with query "${query}": ${error}`)
    return []
  }
}
