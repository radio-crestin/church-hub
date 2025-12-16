import { max } from 'drizzle-orm'

import { getScheduleById } from './getSchedules'
import { getDatabase } from '../../db'
import { presentationQueue } from '../../db/schema'

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
    const now = new Date()

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
      .select({ maxOrder: max(presentationQueue.sortOrder) })
      .from(presentationQueue)
      .get()
    let nextOrder = (maxOrderResult?.maxOrder ?? -1) + 1

    // Insert each schedule item into the queue
    for (const item of schedule.items) {
      if (item.itemType === 'song' && item.songId) {
        db.insert(presentationQueue)
          .values({
            itemType: 'song',
            songId: item.songId,
            sortOrder: nextOrder,
            isExpanded: true,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      } else if (item.itemType === 'slide') {
        db.insert(presentationQueue)
          .values({
            itemType: 'slide',
            slideType: item.slideType!,
            slideContent: item.slideContent!,
            sortOrder: nextOrder,
            isExpanded: true,
            createdAt: now,
            updatedAt: now,
          })
          .run()
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
