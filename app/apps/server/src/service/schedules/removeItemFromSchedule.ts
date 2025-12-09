import { updateScheduleSearchIndex } from './search'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Removes an item from a schedule
 */
export function removeItemFromSchedule(
  scheduleId: number,
  itemId: number,
): boolean {
  try {
    log('debug', `Removing item ${itemId} from schedule ${scheduleId}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    // Delete the item
    const query = db.query(
      'DELETE FROM schedule_items WHERE id = ? AND schedule_id = ?',
    )
    query.run(itemId, scheduleId)

    // Update schedule's updated_at
    db.query('UPDATE schedules SET updated_at = ? WHERE id = ?').run(
      now,
      scheduleId,
    )

    // Update search index
    updateScheduleSearchIndex(scheduleId)

    log('info', `Item removed from schedule: ${itemId}`)
    return true
  } catch (error) {
    log('error', `Failed to remove item from schedule: ${error}`)
    return false
  }
}
