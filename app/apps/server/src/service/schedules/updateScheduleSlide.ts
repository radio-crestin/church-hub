import { getScheduleItemById } from './getSchedules'
import type { ScheduleItem, UpdateScheduleSlideInput } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Updates a standalone slide in a schedule
 */
export function updateScheduleSlide(
  input: UpdateScheduleSlideInput,
): ScheduleItem | null {
  try {
    log('debug', `Updating schedule slide: ${input.id}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    // Verify item exists and is a slide
    const existingItem = db
      .query('SELECT item_type, schedule_id FROM schedule_items WHERE id = ?')
      .get(input.id) as { item_type: string; schedule_id: number } | null

    if (!existingItem) {
      log('error', `Schedule item not found: ${input.id}`)
      return null
    }

    if (existingItem.item_type !== 'slide') {
      log('error', `Cannot update non-slide item: ${input.id}`)
      return null
    }

    // Update the slide
    const updateQuery = db.query(`
      UPDATE schedule_items
      SET slide_type = ?, slide_content = ?, updated_at = ?
      WHERE id = ?
    `)
    updateQuery.run(input.slideType, input.slideContent, now, input.id)

    // Update schedule's updated_at
    db.query('UPDATE schedules SET updated_at = ? WHERE id = ?').run(
      now,
      existingItem.schedule_id,
    )

    log('info', `Schedule slide updated: ${input.id}`)

    return getScheduleItemById(input.id)
  } catch (error) {
    log('error', `Failed to update schedule slide: ${error}`)
    return null
  }
}
