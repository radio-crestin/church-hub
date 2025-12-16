import { and, eq } from 'drizzle-orm'

import { updateScheduleSearchIndex } from './search'
import { getDatabase } from '../../db'
import { scheduleItems, schedules } from '../../db/schema'

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
    const now = new Date()

    // Delete the item
    db.delete(scheduleItems)
      .where(
        and(
          eq(scheduleItems.id, itemId),
          eq(scheduleItems.scheduleId, scheduleId),
        ),
      )
      .run()

    // Update schedule's updated_at
    db.update(schedules)
      .set({ updatedAt: now })
      .where(eq(schedules.id, scheduleId))
      .run()

    // Update search index
    updateScheduleSearchIndex(scheduleId)

    log('info', `Item removed from schedule: ${itemId}`)
    return true
  } catch (error) {
    log('error', `Failed to remove item from schedule: ${error}`)
    return false
  }
}
