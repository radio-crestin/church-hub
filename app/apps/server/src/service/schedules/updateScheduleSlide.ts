import { eq } from 'drizzle-orm'

import { getScheduleItemById } from './getSchedules'
import type { ScheduleItem, UpdateScheduleSlideInput } from './types'
import { getDatabase } from '../../db'
import { scheduleItems, schedules } from '../../db/schema'

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
    const now = new Date()

    // Verify item exists and is a slide
    const existingItem = db
      .select({
        itemType: scheduleItems.itemType,
        scheduleId: scheduleItems.scheduleId,
      })
      .from(scheduleItems)
      .where(eq(scheduleItems.id, input.id))
      .get()

    if (!existingItem) {
      log('error', `Schedule item not found: ${input.id}`)
      return null
    }

    if (existingItem.itemType !== 'slide') {
      log('error', `Cannot update non-slide item: ${input.id}`)
      return null
    }

    // Update the slide
    db.update(scheduleItems)
      .set({
        slideType: input.slideType,
        slideContent: input.slideContent,
        updatedAt: now,
      })
      .where(eq(scheduleItems.id, input.id))
      .run()

    // Update schedule's updated_at
    db.update(schedules)
      .set({ updatedAt: now })
      .where(eq(schedules.id, existingItem.scheduleId))
      .run()

    log('info', `Schedule slide updated: ${input.id}`)

    return getScheduleItemById(input.id)
  } catch (error) {
    log('error', `Failed to update schedule slide: ${error}`)
    return null
  }
}
