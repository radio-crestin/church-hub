import { eq, sql } from 'drizzle-orm'

import type { ReorderScheduleItemsInput } from './types'
import { getDatabase } from '../../db'
import { schedules } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Reorders items within a schedule using a single batch UPDATE with CASE
 */
export function reorderScheduleItems(
  scheduleId: number,
  input: ReorderScheduleItemsInput,
): boolean {
  try {
    log('debug', `Reordering schedule items for schedule: ${scheduleId}`)

    if (input.itemIds.length === 0) {
      return true
    }

    const db = getDatabase()
    const now = new Date()
    const nowTimestamp = Math.floor(now.getTime() / 1000)

    // Build a single UPDATE with CASE for all items (batch operation)
    // This reduces N queries to 1 query
    const caseParts = input.itemIds
      .map((id, index) => `WHEN ${id} THEN ${index}`)
      .join(' ')
    const idList = input.itemIds.join(',')

    db.run(
      sql.raw(`
      UPDATE schedule_items
      SET sort_order = CASE id ${caseParts} END,
          updated_at = ${nowTimestamp}
      WHERE id IN (${idList}) AND schedule_id = ${scheduleId}
    `),
    )

    // Update schedule's updated_at
    db.update(schedules)
      .set({ updatedAt: now })
      .where(eq(schedules.id, scheduleId))
      .run()

    log(
      'info',
      `Schedule items reordered: ${input.itemIds.length} items (batch)`,
    )
    return true
  } catch (error) {
    log('error', `Failed to reorder schedule items: ${error}`)
    return false
  }
}
