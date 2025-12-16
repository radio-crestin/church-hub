import { eq } from 'drizzle-orm'

import { removeFromScheduleSearchIndex } from './search'
import { getDatabase } from '../../db'
import { schedules } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Deletes a schedule and all its items
 */
export function deleteSchedule(id: number): boolean {
  try {
    log('debug', `Deleting schedule: ${id}`)

    const db = getDatabase()

    // Remove from search index first
    removeFromScheduleSearchIndex(id)

    // Delete schedule (cascade will delete items)
    db.delete(schedules).where(eq(schedules.id, id)).run()

    log('info', `Schedule deleted: ${id}`)
    return true
  } catch (error) {
    log('error', `Failed to delete schedule: ${error}`)
    return false
  }
}
