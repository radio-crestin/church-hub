import { and, eq } from 'drizzle-orm'

import type { ReorderScheduleItemsInput } from './types'
import { getDatabase } from '../../db'
import { scheduleItems, schedules } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Reorders items within a schedule
 */
export function reorderScheduleItems(
  scheduleId: number,
  input: ReorderScheduleItemsInput,
): boolean {
  try {
    log('debug', `Reordering schedule items for schedule: ${scheduleId}`)

    const db = getDatabase()
    const now = new Date()

    // Update sort_order for each item
    for (let i = 0; i < input.itemIds.length; i++) {
      db.update(scheduleItems)
        .set({
          sortOrder: i,
          updatedAt: now,
        })
        .where(
          and(
            eq(scheduleItems.id, input.itemIds[i]),
            eq(scheduleItems.scheduleId, scheduleId),
          ),
        )
        .run()
    }

    // Update schedule's updated_at
    db.update(schedules)
      .set({ updatedAt: now })
      .where(eq(schedules.id, scheduleId))
      .run()

    log('info', `Schedule items reordered: ${input.itemIds.length} items`)
    return true
  } catch (error) {
    log('error', `Failed to reorder schedule items: ${error}`)
    return false
  }
}
