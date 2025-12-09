import { getScheduleById } from './getSchedules'
import { getDatabase } from '../../db'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Imports all items from a schedule into the presentation queue
 * Items are appended to the end of the queue in order
 */
export function importScheduleToQueue(scheduleId: number): boolean {
  try {
    log('debug', `Importing schedule to queue: ${scheduleId}`)

    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    // Get the schedule with all items
    const schedule = getScheduleById(scheduleId)
    if (!schedule) {
      log('error', `Schedule not found: ${scheduleId}`)
      return false
    }

    if (schedule.items.length === 0) {
      log('debug', `Schedule has no items: ${scheduleId}`)
      return true
    }

    // Get current max sort_order in queue
    const maxOrderResult = db
      .query('SELECT MAX(sort_order) as max_order FROM presentation_queue')
      .get() as { max_order: number | null }
    let nextOrder = (maxOrderResult?.max_order ?? -1) + 1

    // Insert each schedule item into the queue
    const insertSongQuery = db.query(`
      INSERT INTO presentation_queue (item_type, song_id, sort_order, is_expanded, created_at, updated_at)
      VALUES ('song', ?, ?, 1, ?, ?)
    `)

    const insertSlideQuery = db.query(`
      INSERT INTO presentation_queue (item_type, slide_type, slide_content, sort_order, is_expanded, created_at, updated_at)
      VALUES ('slide', ?, ?, ?, 1, ?, ?)
    `)

    for (const item of schedule.items) {
      if (item.itemType === 'song' && item.songId) {
        insertSongQuery.run(item.songId, nextOrder, now, now)
      } else if (item.itemType === 'slide') {
        insertSlideQuery.run(
          item.slideType,
          item.slideContent,
          nextOrder,
          now,
          now,
        )
      }
      nextOrder++
    }

    log(
      'info',
      `Imported ${schedule.items.length} items from schedule ${scheduleId} to queue`,
    )
    return true
  } catch (error) {
    log('error', `Failed to import schedule to queue: ${error}`)
    return false
  }
}
