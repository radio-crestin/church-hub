import type { ReorderScheduleItemsInput } from './types'
import { getDatabase } from '../../db'

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
    const now = Math.floor(Date.now() / 1000)

    // Update sort_order for each item
    const updateQuery = db.query(`
      UPDATE schedule_items
      SET sort_order = ?, updated_at = ?
      WHERE id = ? AND schedule_id = ?
    `)

    for (let i = 0; i < input.itemIds.length; i++) {
      updateQuery.run(i, now, input.itemIds[i], scheduleId)
    }

    // Update schedule's updated_at
    db.query('UPDATE schedules SET updated_at = ? WHERE id = ?').run(
      now,
      scheduleId,
    )

    log('info', `Schedule items reordered: ${input.itemIds.length} items`)
    return true
  } catch (error) {
    log('error', `Failed to reorder schedule items: ${error}`)
    return false
  }
}
