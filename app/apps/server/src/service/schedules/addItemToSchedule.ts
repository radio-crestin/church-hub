import { getScheduleItemById } from './getSchedules'
import { updateScheduleSearchIndex } from './search'
import type { AddToScheduleInput, ScheduleItem } from './types'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Adds an item (song or slide) to a schedule
 */
export function addItemToSchedule(
  input: AddToScheduleInput,
): ScheduleItem | null {
  try {
    const isSong = input.songId !== undefined
    log(
      'debug',
      `Adding ${isSong ? 'song' : 'slide'} to schedule: ${input.scheduleId}`,
    )

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    let targetOrder: number

    if (input.afterItemId) {
      // Get the sort_order of the item we're inserting after
      const afterItem = db
        .query('SELECT sort_order FROM schedule_items WHERE id = ?')
        .get(input.afterItemId) as { sort_order: number } | null

      if (!afterItem) {
        log('error', `Schedule item not found: ${input.afterItemId}`)
        return null
      }

      targetOrder = afterItem.sort_order + 1

      // Shift all items after the target position
      db.query(
        `
        UPDATE schedule_items
        SET sort_order = sort_order + 1, updated_at = ?
        WHERE schedule_id = ? AND sort_order >= ?
      `,
      ).run(now, input.scheduleId, targetOrder)
    } else {
      // Get the max sort_order to append at the end
      const maxOrderResult = db
        .query(
          'SELECT MAX(sort_order) as max_order FROM schedule_items WHERE schedule_id = ?',
        )
        .get(input.scheduleId) as { max_order: number | null }
      targetOrder = (maxOrderResult?.max_order ?? -1) + 1
    }

    // Insert the item
    if (isSong) {
      const insertQuery = db.query(`
        INSERT INTO schedule_items (schedule_id, item_type, song_id, sort_order, created_at, updated_at)
        VALUES (?, 'song', ?, ?, ?, ?)
      `)
      insertQuery.run(input.scheduleId, input.songId!, targetOrder, now, now)
    } else {
      const insertQuery = db.query(`
        INSERT INTO schedule_items (schedule_id, item_type, slide_type, slide_content, sort_order, created_at, updated_at)
        VALUES (?, 'slide', ?, ?, ?, ?, ?)
      `)
      insertQuery.run(
        input.scheduleId,
        input.slideType!,
        input.slideContent!,
        targetOrder,
        now,
        now,
      )
    }

    // Get the inserted ID
    const getLastId = db.query('SELECT last_insert_rowid() as id')
    const result = getLastId.get() as { id: number }
    const itemId = result.id

    // Update schedule's updated_at
    db.query('UPDATE schedules SET updated_at = ? WHERE id = ?').run(
      now,
      input.scheduleId,
    )

    // Update search index
    updateScheduleSearchIndex(input.scheduleId)

    log('info', `Item added to schedule: ${itemId}`)

    return getScheduleItemById(itemId)
  } catch (error) {
    log('error', `Failed to add item to schedule: ${error}`)
    return null
  }
}
