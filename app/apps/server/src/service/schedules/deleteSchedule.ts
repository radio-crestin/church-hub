import { removeFromScheduleSearchIndex } from './search'
import { getDatabase } from '../../db'

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
    const query = db.query('DELETE FROM schedules WHERE id = ?')
    query.run(id)

    log('info', `Schedule deleted: ${id}`)
    return true
  } catch (error) {
    log('error', `Failed to delete schedule: ${error}`)
    return false
  }
}
