import { and, eq } from 'drizzle-orm'

import type { OperationResult } from './types'
import { getDatabase } from '../../db'
import { scheduleItems } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Sets the manual "already sung" marker on a schedule item. `sungAt` is stamped
 * when marking sung and cleared when unmarking — same contract as
 * `markBookmarkSung`, but scoped to one schedule so the same song can be
 * pending in one program and sung in another.
 */
export function markScheduleItemSung(
  scheduleId: number,
  itemId: number,
  isSung: boolean,
): OperationResult {
  try {
    log('debug', `Marking schedule item ${itemId} sung=${isSung}`)

    const db = getDatabase()
    const item = db
      .select({ id: scheduleItems.id })
      .from(scheduleItems)
      .where(
        and(
          eq(scheduleItems.id, itemId),
          eq(scheduleItems.scheduleId, scheduleId),
        ),
      )
      .get()

    if (!item) {
      log(
        'warning',
        `Schedule item ${itemId} not found in schedule ${scheduleId}`,
      )
      return { success: false, error: 'Schedule item not found' }
    }

    db.update(scheduleItems)
      .set({
        isSung,
        sungAt: isSung ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(scheduleItems.id, itemId))
      .run()

    log('info', `Schedule item ${itemId} marked sung=${isSung}`)
    return { success: true }
  } catch (error) {
    log('error', `Failed to mark schedule item sung: ${error}`)
    return { success: false, error: String(error) }
  }
}
