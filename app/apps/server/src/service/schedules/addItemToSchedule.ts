import { and, eq, gte, max, sql } from 'drizzle-orm'

import { getScheduleItemById } from './getSchedules'
import { updateScheduleSearchIndex } from './search'
import type { AddToScheduleInput, ScheduleItem } from './types'
import { getDatabase } from '../../db'
import { scheduleItems, schedules } from '../../db/schema'

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
    const now = new Date()

    let targetOrder: number

    if (input.afterItemId) {
      // Get the sort_order of the item we're inserting after
      const afterItem = db
        .select({ sortOrder: scheduleItems.sortOrder })
        .from(scheduleItems)
        .where(eq(scheduleItems.id, input.afterItemId))
        .get()

      if (!afterItem) {
        log('error', `Schedule item not found: ${input.afterItemId}`)
        return null
      }

      targetOrder = afterItem.sortOrder + 1

      // Shift all items after the target position
      db.update(scheduleItems)
        .set({
          sortOrder: sql`${scheduleItems.sortOrder} + 1`,
          updatedAt: now,
        })
        .where(
          and(
            eq(scheduleItems.scheduleId, input.scheduleId),
            gte(scheduleItems.sortOrder, targetOrder),
          ),
        )
        .run()
    } else {
      // Get the max sort_order to append at the end
      const maxOrderResult = db
        .select({ maxOrder: max(scheduleItems.sortOrder) })
        .from(scheduleItems)
        .where(eq(scheduleItems.scheduleId, input.scheduleId))
        .get()
      targetOrder = (maxOrderResult?.maxOrder ?? -1) + 1
    }

    // Insert the item
    let itemId: number
    if (isSong) {
      const result = db
        .insert(scheduleItems)
        .values({
          scheduleId: input.scheduleId,
          itemType: 'song',
          songId: input.songId!,
          sortOrder: targetOrder,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: scheduleItems.id })
        .get()
      itemId = result.id
    } else {
      const result = db
        .insert(scheduleItems)
        .values({
          scheduleId: input.scheduleId,
          itemType: 'slide',
          slideType: input.slideType!,
          slideContent: input.slideContent!,
          sortOrder: targetOrder,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: scheduleItems.id })
        .get()
      itemId = result.id
    }

    // Update schedule's updated_at
    db.update(schedules)
      .set({ updatedAt: now })
      .where(eq(schedules.id, input.scheduleId))
      .run()

    // Update search index
    updateScheduleSearchIndex(input.scheduleId)

    log('info', `Item added to schedule: ${itemId}`)

    return getScheduleItemById(itemId)
  } catch (error) {
    log('error', `Failed to add item to schedule: ${error}`)
    return null
  }
}
