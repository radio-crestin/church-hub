import { asc } from 'drizzle-orm'

import { getDatabase } from '../../db'
import { presentationQueue, scheduleItems, schedules } from '../../db/schema'
import { updateScheduleSearchIndex } from '../schedules/search'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [queue] ${message}`)
}

/**
 * Exports the current queue to a new schedule
 * Creates a schedule with the given title and copies all queue items to it
 * Returns the new schedule ID or null on failure
 */
export function exportQueueToSchedule(title: string): number | null {
  try {
    log('debug', `Exporting queue to schedule: ${title}`)

    const db = getDatabase()
    const now = new Date()

    // Get all queue items ordered by sortOrder
    const queueItems = db
      .select()
      .from(presentationQueue)
      .orderBy(asc(presentationQueue.sortOrder))
      .all()

    if (queueItems.length === 0) {
      log('warning', 'Cannot export empty queue')
      return null
    }

    // Create the new schedule
    const scheduleResult = db
      .insert(schedules)
      .values({
        title,
        description: null,
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: schedules.id })
      .get()

    const scheduleId = scheduleResult.id
    log('debug', `Created schedule: ${scheduleId}`)

    // Copy queue items to schedule items
    let sortOrder = 0
    for (const item of queueItems) {
      if (item.itemType === 'song' && item.songId) {
        db.insert(scheduleItems)
          .values({
            scheduleId,
            itemType: 'song',
            songId: item.songId,
            sortOrder,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      } else if (item.itemType === 'slide') {
        db.insert(scheduleItems)
          .values({
            scheduleId,
            itemType: 'slide',
            slideType: item.slideType!,
            slideContent: item.slideContent!,
            sortOrder,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      }
      // Note: Bible verses are not supported in schedules currently
      sortOrder++
    }

    // Update search index
    updateScheduleSearchIndex(scheduleId)

    log('info', `Exported ${queueItems.length} items to schedule ${scheduleId}`)
    return scheduleId
  } catch (error) {
    log('error', `Failed to export queue to schedule: ${error}`)
    return null
  }
}
