import type { ScheduleSearchResult } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedule-search] ${message}`)
}

/**
 * Updates the FTS index for a specific schedule
 * Indexes schedule title, description, and all song content
 */
export function updateScheduleSearchIndex(scheduleId: number): void {
  try {
    log('debug', `Updating search index for schedule: ${scheduleId}`)

    const db = getDatabase()

    // Get schedule metadata
    const scheduleQuery = db.query(
      'SELECT title, description FROM schedules WHERE id = ?',
    )
    const schedule = scheduleQuery.get(scheduleId) as {
      title: string
      description: string | null
    } | null

    if (!schedule) {
      log('debug', `Schedule not found for indexing: ${scheduleId}`)
      return
    }

    // Get all song titles in this schedule
    const songTitlesQuery = db.query(`
      SELECT s.title
      FROM schedule_items si
      JOIN songs s ON si.song_id = s.id
      WHERE si.schedule_id = ? AND si.item_type = 'song'
      ORDER BY si.sort_order ASC
    `)
    const songTitles = songTitlesQuery.all(scheduleId) as { title: string }[]
    const combinedTitles = songTitles.map((s) => s.title).join(' ')

    // Get all song content in this schedule
    const songContentQuery = db.query(`
      SELECT ss.content
      FROM schedule_items si
      JOIN song_slides ss ON si.song_id = ss.song_id
      WHERE si.schedule_id = ? AND si.item_type = 'song'
      ORDER BY si.sort_order ASC, ss.sort_order ASC
    `)
    const songContent = songContentQuery.all(scheduleId) as {
      content: string
    }[]
    const combinedContent = songContent.map((s) => s.content).join(' ')

    // Remove existing index entry
    const deleteQuery = db.query(
      'DELETE FROM schedules_fts WHERE schedule_id = ?',
    )
    deleteQuery.run(scheduleId)

    // Insert new index entry
    const insertQuery = db.query(`
      INSERT INTO schedules_fts (schedule_id, title, description, song_titles, song_content)
      VALUES (?, ?, ?, ?, ?)
    `)
    insertQuery.run(
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
 */
export function removeFromScheduleSearchIndex(scheduleId: number): void {
  try {
    log('debug', `Removing schedule from search index: ${scheduleId}`)

    const db = getDatabase()
    const query = db.query('DELETE FROM schedules_fts WHERE schedule_id = ?')
    query.run(scheduleId)

    log('debug', `Schedule removed from search index: ${scheduleId}`)
  } catch (error) {
    log('error', `Failed to remove from search index: ${error}`)
  }
}

/**
 * Rebuilds the entire schedule search index
 */
export function rebuildScheduleSearchIndex(): void {
  try {
    log('info', 'Rebuilding schedule search index...')

    const db = getDatabase()

    // Clear existing index
    db.exec('DELETE FROM schedules_fts')

    // Get all schedules
    const schedulesQuery = db.query('SELECT id FROM schedules')
    const schedules = schedulesQuery.all() as { id: number }[]

    for (const schedule of schedules) {
      updateScheduleSearchIndex(schedule.id)
    }

    log(
      'info',
      `Schedule search index rebuilt: ${schedules.length} schedules indexed`,
    )
  } catch (error) {
    log('error', `Failed to rebuild search index: ${error}`)
  }
}

/**
 * Searches schedules using FTS5
 * Searches in title, description, song titles, and song content
 */
export function searchSchedules(query: string): ScheduleSearchResult[] {
  try {
    log('debug', `Searching schedules: ${query}`)

    if (!query.trim()) {
      return []
    }

    const db = getDatabase()

    // Use FTS5 MATCH query with snippet for highlighting
    // Note: snippet() doesn't work with GROUP BY, so we use a subquery for item_count
    const searchQuery = db.query(`
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

    const results = searchQuery.all(escapedQuery) as Array<{
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
