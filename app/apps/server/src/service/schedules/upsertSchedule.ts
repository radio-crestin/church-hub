import { updateScheduleSearchIndex } from './search'
import type { Schedule, UpsertScheduleInput } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Creates or updates a schedule
 */
export function upsertSchedule(input: UpsertScheduleInput): Schedule | null {
  try {
    log('debug', `Upserting schedule: ${input.id ?? 'new'}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    let scheduleId: number

    if (input.id) {
      // Update existing schedule
      const updateQuery = db.query(`
        UPDATE schedules
        SET title = ?, description = ?, updated_at = ?
        WHERE id = ?
      `)
      updateQuery.run(input.title, input.description ?? null, now, input.id)
      scheduleId = input.id
      log('info', `Schedule updated: ${scheduleId}`)
    } else {
      // Create new schedule
      const insertQuery = db.query(`
        INSERT INTO schedules (title, description, created_at, updated_at)
        VALUES (?, ?, ?, ?)
      `)
      insertQuery.run(input.title, input.description ?? null, now, now)

      const getLastId = db.query('SELECT last_insert_rowid() as id')
      const result = getLastId.get() as { id: number }
      scheduleId = result.id
      log('info', `Schedule created: ${scheduleId}`)
    }

    // Update search index
    updateScheduleSearchIndex(scheduleId)

    // Get counts for response
    const countsQuery = db.query(`
      SELECT
        COUNT(si.id) as item_count,
        SUM(CASE WHEN si.item_type = 'song' THEN 1 ELSE 0 END) as song_count
      FROM schedule_items si
      WHERE si.schedule_id = ?
    `)
    const counts = countsQuery.get(scheduleId) as {
      item_count: number
      song_count: number
    }

    // Get updated schedule
    const scheduleQuery = db.query('SELECT * FROM schedules WHERE id = ?')
    const schedule = scheduleQuery.get(scheduleId) as {
      id: number
      title: string
      description: string | null
      created_at: number
      updated_at: number
    }

    return {
      id: schedule.id,
      title: schedule.title,
      description: schedule.description,
      itemCount: counts.item_count,
      songCount: counts.song_count,
      createdAt: schedule.created_at,
      updatedAt: schedule.updated_at,
    }
  } catch (error) {
    log('error', `Failed to upsert schedule: ${error}`)
    return null
  }
}
