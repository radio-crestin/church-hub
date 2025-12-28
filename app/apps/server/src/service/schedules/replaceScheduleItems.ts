import { eq } from 'drizzle-orm'

import { getScheduleById } from './getSchedules'
import { updateScheduleSearchIndex } from './search'
import type { OperationResult, SlideTemplate } from './types'
import { getDatabase } from '../../db'
import { scheduleItems, schedules } from '../../db/schema'

const DEBUG = process.env.DEBUG === 'true'

function log(level: 'debug' | 'info' | 'warning' | 'error', message: string) {
  if (level === 'debug' && !DEBUG) return
  // biome-ignore lint/suspicious/noConsole: logging utility
  console.log(`[${level.toUpperCase()}] [schedules] ${message}`)
}

/**
 * Input for a single item to replace
 */
export interface ReplaceItemInput {
  type: 'song' | 'slide'
  songId?: number
  slideType?: SlideTemplate
  slideContent?: string
}

/**
 * Input for replacing all items in a schedule
 */
export interface ReplaceScheduleItemsInput {
  scheduleId: number
  items: ReplaceItemInput[]
}

/**
 * Result of replace operation
 */
export interface ReplaceScheduleItemsResult extends OperationResult {
  schedule?: {
    id: number
    title: string
    itemCount: number
  }
}

/**
 * Replaces all items in a schedule with new items
 * Deletes existing items and inserts new ones in order
 */
export function replaceScheduleItems(
  input: ReplaceScheduleItemsInput,
): ReplaceScheduleItemsResult {
  try {
    log('debug', `Replacing items in schedule: ${input.scheduleId}`)

    const db = getDatabase()
    const now = new Date()

    // Verify schedule exists
    const schedule = getScheduleById(input.scheduleId)
    if (!schedule) {
      log('error', `Schedule not found: ${input.scheduleId}`)
      return { success: false, error: 'Schedule not found' }
    }

    // Delete all existing items for this schedule
    db.delete(scheduleItems)
      .where(eq(scheduleItems.scheduleId, input.scheduleId))
      .run()

    log('debug', `Deleted existing items for schedule: ${input.scheduleId}`)

    // Insert new items with correct sort order
    for (let i = 0; i < input.items.length; i++) {
      const item = input.items[i]

      if (item.type === 'song' && item.songId) {
        db.insert(scheduleItems)
          .values({
            scheduleId: input.scheduleId,
            itemType: 'song',
            songId: item.songId,
            sortOrder: i,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      } else if (item.type === 'slide' && item.slideType && item.slideContent) {
        db.insert(scheduleItems)
          .values({
            scheduleId: input.scheduleId,
            itemType: 'slide',
            slideType: item.slideType,
            slideContent: item.slideContent,
            sortOrder: i,
            createdAt: now,
            updatedAt: now,
          })
          .run()
      }
    }

    // Update schedule's updated_at
    db.update(schedules)
      .set({ updatedAt: now })
      .where(eq(schedules.id, input.scheduleId))
      .run()

    // Update search index
    updateScheduleSearchIndex(input.scheduleId)

    log(
      'info',
      `Replaced ${input.items.length} items in schedule: ${input.scheduleId}`,
    )

    return {
      success: true,
      schedule: {
        id: input.scheduleId,
        title: schedule.title,
        itemCount: input.items.length,
      },
    }
  } catch (error) {
    log('error', `Failed to replace schedule items: ${error}`)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
